let list = JSON.parse(localStorage.getItem("wishlist") || "[]");

// ---------- User ----------
const usernameInput = document.getElementById("username");
let currentUser = localStorage.getItem("wishlistUser") || "";
usernameInput.value = currentUser;

usernameInput.addEventListener("input", () => {
  currentUser = usernameInput.value.trim();
  localStorage.setItem("wishlistUser", currentUser);
});

// ---------- Tabs ----------
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

// ---------- Toast ----------
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

// ---------- Helpers ----------
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

// NEW: currency helpers
function currencySymbol(code) {
  const map = { UAH: "₴", USD: "$", EUR: "€" };
  return map[code] || "";
}

function save() {
  localStorage.setItem("wishlist", JSON.stringify(list));
}

function clearForm() {
  document.getElementById("name").value = "";
  document.getElementById("category").value = "техніка";
  document.getElementById("imageUrl").value = "";
  document.getElementById("price").value = "";
  document.getElementById("currency").value = "UAH"; // NEW
  document.getElementById("productUrl").value = "";
  document.getElementById("description").value = "";
}

// ---------- Filters ----------
const searchInput = document.getElementById("searchInput");
const filterCategory = document.getElementById("filterCategory");
const filterStatus = document.getElementById("filterStatus");
const minPrice = document.getElementById("minPrice");
const maxPrice = document.getElementById("maxPrice");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

function toNumberOrNull(str) {
  const s = String(str || "").trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

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

// ---------- Add ----------
document.getElementById("addBtn").onclick = () => {
  const name = document.getElementById("name").value.trim();
  const category = document.getElementById("category").value;
  const imageUrlRaw = document.getElementById("imageUrl").value.trim();
  const priceRaw = document.getElementById("price").value.trim();
  const currency = document.getElementById("currency").value; // NEW
  const url = document.getElementById("productUrl").value.trim();
  const description = document.getElementById("description").value.trim();

  if (!currentUser) {
    showToast("Вкажи своє ім'я зверху (хто додає товар).");
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
    currency, // NEW
    url,
    description,
    status: "Хочу",
    id: Date.now(),
    addedBy: currentUser
  };

  list.push(item);
  save();
  clearForm();
  showToast("Товар додано ✅");

  document.querySelector('.tab-btn[data-tab="list"]').click();
};

// ---------- Render ----------
function render() {
  const container = document.getElementById("list");
  const itemsCount = document.getElementById("itemsCount");

  container.innerHTML = "";

  const q = (searchInput?.value || "").trim().toLowerCase();
  const cat = filterCategory?.value || "";
  const st = filterStatus?.value || "";
  const minN = toNumberOrNull(minPrice?.value);
  const maxN = toNumberOrNull(maxPrice?.value);

  const filtered = list.filter(item => {
    const nameOk = item.name.toLowerCase().includes(q);
    const catOk = !cat || item.category === cat;
    const stOk = !st || item.status === st;

    const p = Number(String(item.price).replace(",", "."));
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
    const priceText = `${escapeHtml(item.price)} ${sym || ""}`.trim();

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

        <label>Статус: </label>
        <select class="status-select">
          <option ${item.status === "Хочу" ? "selected" : ""}>Хочу</option>
          <option ${item.status === "Куплено" ? "selected" : ""}>Куплено</option>
          <option ${item.status === "Передумав" ? "selected" : ""}>Передумав</option>
        </select>
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

    editBtn.onclick = (e) => {
      e.stopPropagation();
      editItem(item.id);
      menu.style.display = "none";
    };

    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteItem(item.id);
      menu.style.display = "none";
    };

    statusSelect.onchange = () => {
      updateStatus(item.id, statusSelect.value);
      showToast("Статус змінено ✅");
    };

    container.appendChild(div);
  });
}

document.addEventListener("click", () => closeAllMenus());
function closeAllMenus() {
  document.querySelectorAll(".menu").forEach(m => (m.style.display = "none"));
}

// ---------- Actions ----------
function updateStatus(id, value) {
  list = list.map(item => item.id === id ? { ...item, status: value } : item);
  save();
}

function deleteItem(id) {
  list = list.filter(item => item.id !== id);
  save();
  render();
  showToast("Видалено 🗑️");
}

function editItem(id) {
  const item = list.find(i => i.id === id);
  if (!item) return;

  document.getElementById("name").value = item.name;
  document.getElementById("category").value = item.category;
  document.getElementById("imageUrl").value = item.imageUrl;
  document.getElementById("price").value = item.price;
  document.getElementById("currency").value = item.currency || "UAH"; // NEW
  document.getElementById("productUrl").value = item.url;
  document.getElementById("description").value = item.description || "";

  deleteItem(id);
  document.querySelector('.tab-btn[data-tab="add"]').click();
  showToast("Можеш відредагувати і натиснути “Додати” ✅");
}

// Escape
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
