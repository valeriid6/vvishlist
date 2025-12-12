/* ================= FIREBASE (module) ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhnd4JLwejiDqmlyqP0S4ipBRtDeXfVtw",
  authDomain: "vvishlist-96fc7.firebaseapp.com",
  projectId: "vvishlist-96fc7",
  storageBucket: "vvishlist-96fc7.firebasestorage.app",
  messagingSenderId: "591671325794",
  appId: "1:591671325794:web:6ce3508d62f1b8b5fa0d3b",
  measurementId: "G-BJ0HGSPGFB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

console.log("🔥 Firebase connected");

/* ================= APP STATE ================= */
let list = []; // тепер список з Firestore
let currentUser = null;

/* ================= UI: Tabs ================= */
const tabButtons = document.querySelectorAll(".tab-btn");
const addSection = document.getElementById("addSection");
const listSection = document.getElementById("listSection");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    if (tab === "add") {
      addSection.classList.add("active");
      listSection.classList.remove("active");
    } else {
      addSection.classList.remove("active");
      listSection.classList.add("active");
      render();
    }
    closeAllMenus();
  });
});

/* ================= Toast ================= */
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ================= Helpers ================= */
function isLikelyUrl(str) {
  return /^https?:\/\/.+/i.test(str);
}

function getDefaultImage(cat) {
  const defaults = {
    "техніка": "https://i.imgur.com/8QfQpKZ.png",
    "одяг": "https://i.imgur.com/evr5wK2.png",
    "аксесуари": "https://i.imgur.com/d9KHkqO.png",
    "інше": "https://i.imgur.com/Sm8p2pS.png"
  };
  return defaults[cat] || defaults["інше"];
}

function currencySymbol(code) {
  const map = { UAH: "₴", USD: "$", EUR: "€" };
  return map[code] || "";
}

function clearForm() {
  document.getElementById("name").value = "";
  document.getElementById("category").value = "техніка";
  document.getElementById("imageUrl").value = "";
  document.getElementById("price").value = "";
  document.getElementById("currency").value = "UAH";
  document.getElementById("productUrl").value = "";
  document.getElementById("description").value = "";
}

function toNumberOrNull(str) {
  const s = String(str || "").trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ================= Auth UI ================= */
const authStatus = document.getElementById("authStatus");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error(e);
    showToast("Не вдалось увійти 😕");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.error(e);
    showToast("Не вдалось вийти 😕");
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;

  if (currentUser) {
    const name = currentUser.displayName || currentUser.email || "Користувач";
    authStatus.textContent = name;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
  } else {
    authStatus.textContent = "не увійшов";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
  }

  // старт/рестарт підписки на базу (після логіну/логауту)
  startLiveSync();
});

/* ================= Firestore live sync ================= */
let unsub = null;

function startLiveSync() {
  if (unsub) {
    unsub();
    unsub = null;
  }

  // Публічний спільний список: всі бачать всі
  const itemsRef = collection(db, "items");
  const qRef = query(itemsRef, orderBy("createdAt", "desc"));

  unsub = onSnapshot(qRef, (snap) => {
    list = snap.docs.map(d => ({ ...d.data(), docId: d.id }));
    render();
  }, (err) => {
    console.error(err);
    showToast("Помилка з базою. Перевір правила Firestore.");
  });
}

/* ================= Filters ================= */
const searchInput = document.getElementById("searchInput");
const filterCategory = document.getElementById("filterCategory");
const filterStatus = document.getElementById("filterStatus");
const minPrice = document.getElementById("minPrice");
const maxPrice = document.getElementById("maxPrice");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

[searchInput, filterCategory, filterStatus, minPrice, maxPrice].forEach(el => {
  el.addEventListener("input", () => render());
  el.addEventListener("change", () => render());
});

resetFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  filterCategory.value = "";
  filterStatus.value = "";
  minPrice.value = "";
  maxPrice.value = "";
  render();
});

/* ================= Add item (Firestore) ================= */
document.getElementById("addBtn").onclick = async () => {
  const name = document.getElementById("name").value.trim();
  const category = document.getElementById("category").value;
  const imageUrlRaw = document.getElementById("imageUrl").value.trim();
  const priceRaw = document.getElementById("price").value.trim();
  const currency = document.getElementById("currency").value;
  const url = document.getElementById("productUrl").value.trim();
  const description = document.getElementById("description").value.trim();

  if (!currentUser) {
    showToast("Спочатку увійди через Google ✅");
    return;
  }

  if (!name || !priceRaw || !url) {
    showToast("Заповни обов’язкові поля: Назва, Ціна, Посилання на товар.");
    return;
  }

  const normalizedPrice = priceRaw.replace(",", ".");
  const priceNumber = Number(normalizedPrice);
  if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
    showToast("Вкажи коректну ціну (число більше 0).");
    return;
  }

  if (!isLikelyUrl(url)) {
    showToast("Посилання на товар має починатися з http:// або https://");
    return;
  }

  let imageUrl = imageUrlRaw;
  if (imageUrl && !isLikelyUrl(imageUrl)) {
    showToast("Посилання на фото має починатися з http:// або https://");
    return;
  }
  if (!imageUrl) imageUrl = getDefaultImage(category);

  const item = {
    name,
    category,
    imageUrl,
    price: String(priceNumber),
    currency,
    url,
    description,
    status: "Хочу",
    addedBy: currentUser.displayName || currentUser.email || "Користувач",
    userId: currentUser.uid,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "items"), item);
    clearForm();
    showToast("Товар додано ✅");
    document.querySelector('.tab-btn[data-tab="list"]').click();
  } catch (e) {
    console.error(e);
    showToast("Не вдалось додати. Перевір Firestore Rules.");
  }
};

/* ================= Render ================= */
function render() {
  const container = document.getElementById("list");
  const itemsCount = document.getElementById("itemsCount");

  container.innerHTML = "";

  const qText = (searchInput?.value || "").trim().toLowerCase();
  const cat = filterCategory?.value || "";
  const st = filterStatus?.value || "";
  const minN = toNumberOrNull(minPrice?.value);
  const maxN = toNumberOrNull(maxPrice?.value);

  const filtered = list.filter(item => {
    const nameOk = String(item.name || "").toLowerCase().includes(qText);
    const catOk = !cat || item.category === cat;
    const stOk = !st || item.status === st;

    const p = Number(String(item.price || "").replace(",", "."));
    const priceOkMin = (minN === null) ? true : (p >= minN);
    const priceOkMax = (maxN === null) ? true : (p <= maxN);

    return nameOk && catOk && stOk && priceOkMin && priceOkMax;
  });

  if (!list.length) {
    itemsCount.textContent = "Поки що порожньо";
  } else if (filtered.length === list.length) {
    itemsCount.textContent = `Усього: ${list.length}`;
  } else {
    itemsCount.textContent = `Показано: ${filtered.length} / ${list.length}`;
  }

  filtered.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";

    const sym = currencySymbol(item.currency || "UAH");
    const priceText = `${escapeHtml(item.price)} ${sym}`.trim();

    div.innerHTML = `
      <div class="menu-btn" title="Меню">⋮</div>
      <div class="menu">
        <button class="edit-btn">Редагувати</button>
        <button class="delete-btn">Видалити</button>
      </div>

      <img src="${item.imageUrl}" alt="">
      <div class="item-info">
        <h3>${escapeHtml(item.name)}</h3>
        <p>Категорія: ${escapeHtml(item.category)}</p>
        <p>Ціна: ${priceText}</p>
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">Перейти до товару</a><br>

        <div class="added-by">Додав(ла): ${escapeHtml(item.addedBy || "—")}</div>

        <div class="status-box">
	<label>Статус: </label>
        <select class="status-select">
          <option ${item.status === "Хочу" ? "selected" : ""}>Хочу</option>
          <option ${item.status === "Куплено" ? "selected" : ""}>Куплено</option>
          <option ${item.status === "Передумав" ? "selected" : ""}>Передумав</option>
        </select>
	</div>
      </div>
    `;

    const menuBtn = div.querySelector(".menu-btn");
    const menu = div.querySelector(".menu");
    const editBtn = div.querySelector(".edit-btn");
    const deleteBtn = div.querySelector(".delete-btn");
    const statusSelect = div.querySelector(".status-select");

    menuBtn.onclick = (e) => {
      e.stopPropagation();
      const isOpen = menu.style.display === "block";
      closeAllMenus();
      menu.style.display = isOpen ? "none" : "block";
    };

    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      await deleteItem(item.docId, item.userId);
      menu.style.display = "none";
    };

    editBtn.onclick = async (e) => {
      e.stopPropagation();
      await editItem(item);
      menu.style.display = "none";
    };

    statusSelect.onchange = async () => {
      await updateStatus(item.docId, statusSelect.value);
      showToast("Статус змінено ✅");
    };

    container.appendChild(div);
  });
}

document.addEventListener("click", () => closeAllMenus());
function closeAllMenus() {
  document.querySelectorAll(".menu").forEach(m => (m.style.display = "none"));
}

/* ================= Actions (Firestore) ================= */
async function updateStatus(docId, value) {
  try {
    await updateDoc(doc(db, "items", docId), { status: value });
  } catch (e) {
    console.error(e);
    showToast("Не вдалось змінити статус 😕");
  }
}

async function deleteItem(docId, ownerUserId) {
  if (!currentUser) {
    showToast("Спочатку увійди ✅");
    return;
  }

  // просте правило: видаляти може тільки той, хто додав
  if (currentUser.uid !== ownerUserId) {
    showToast("Ти не можеш видалити чужий товар 🙂");
    return;
  }

  try {
    await deleteDoc(doc(db, "items", docId));
    showToast("Видалено 🗑️");
  } catch (e) {
    console.error(e);
    showToast("Не вдалось видалити 😕");
  }
}

async function editItem(item) {
  if (!currentUser) {
    showToast("Спочатку увійди ✅");
    return;
  }
  if (currentUser.uid !== item.userId) {
    showToast("Ти не можеш редагувати чужий товар 🙂");
    return;
  }

  // Заповнюємо форму
  document.getElementById("name").value = item.name || "";
  document.getElementById("category").value = item.category || "техніка";
  document.getElementById("imageUrl").value = item.imageUrl || "";
  document.getElementById("price").value = item.price || "";
  document.getElementById("currency").value = item.currency || "UAH";
  document.getElementById("productUrl").value = item.url || "";
  document.getElementById("description").value = item.description || "";

  // Видаляємо старий документ, щоб після “Додати” створити оновлений (простий шлях)
  try {
    await deleteDoc(doc(db, "items", item.docId));
    document.querySelector('.tab-btn[data-tab="add"]').click();
    showToast("Відредагуй і натисни “Додати” ✅");
  } catch (e) {
    console.error(e);
    showToast("Не вдалось перейти в редагування 😕");
  }
}

/* initial render */
render();
