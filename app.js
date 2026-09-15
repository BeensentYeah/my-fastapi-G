const API_URL = "https://my-fastapi-g.vercel.app";
const API_KEY = "student-api-key-123"

const FETCH_OPTIONS = {
    headers: {
        "x-api-key": API_KEY
    }
};

// PAGINATION & DATA STATE
let currentPage = 1;
const itemsPerPage = 9;
let allItems = [];
let currentItemsList = [];
let activeCategory = "All";
let categoryList = [];

const FALLBACK_IMG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#081118"/><polygon points="32,12 50,22 50,42 32,52 14,42 14,22" fill="none" stroke="#c8aa6e" stroke-width="2"/></svg>`
    );

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
}

function getStatColorClass(statKey) {
    const colorMap = {
        attackDamage: "stat-ad",
        abilityPower: "stat-ap",
        health: "stat-health",
        omnivamp: "stat-vamp",
        lifeSteal: "stat-vamp",
        movementSpeed: "stat-ms",
        mana: "stat-mana",
        armor: "stat-armor",
        magicResist: "stat-mr",
        attackSpeed: "stat-utility",
        critChance: "stat-crit",
        abilityHaste: "stat-ah",
        lethality: "stat-armor-pen",
        armorPenetration: "stat-armor-pen",
        magicPenetration: "stat-magic-pen",
        tenacity: "stat-utility"
    };

    return colorMap[statKey] || "stat-default";
}

const STAT_LABELS = {
    attackDamage: "AD",
    abilityPower: "AP",
    health: "Health",
    movementSpeed: "MS",
    mana: "Mana",
    armor: "Armor",
    magicResist: "MR",
    attackSpeed: "AS%",
    critChance: "Crit%",
    abilityHaste: "AH",
    lifeSteal: "Lifesteal%",
    lethality: "Lethality",
    armorPenetration: "Armor Pen%",
    magicPenetration: "Magic Pen",
    tenacity: "Tenacity%",
    omnivamp: "Omnivamp%"
};

function renderCardStats(item) {
    let activeStats = [];

    for (let key in STAT_LABELS) {
        if (item[key] && item[key] > 0) {
            let unit = STAT_LABELS[key].includes("%") ? "%" : "";
            let cleanLabel = STAT_LABELS[key].replace("%", "");
            let colorClass = getStatColorClass(key);
            activeStats.push(`<span class="${colorClass}">+${item[key]}${unit} ${escapeHtml(cleanLabel)}</span>`);
        }
    }

    if (activeStats.length === 0) return "";

    return `<div class="card-stats-preview">${activeStats.join("")}</div>`;
}

async function loadItems() {
    try {
        const response = await fetch(
            `${API_URL}/api/v1/items`,
            FETCH_OPTIONS
        );
        const data = await response.json();

        allItems = data.items || [];
        activeCategory = "All";
        renderCategoryFilters();

        currentItemsList = allItems;
        currentPage = 1;

        renderPaginatedItems();

    } catch (error) {
        console.error(error);

        const itemList = document.getElementById("itemList");

        if (itemList) {
            itemList.innerHTML = "<p class=\"state-msg\">Unable to connect to the API.</p>";
        }
    }
}

function renderCategoryFilters() {
    const container = document.getElementById("categoryFilters");
    if (!container) return;

    categoryList = ["All", ...new Set(allItems.map(item => item.category).filter(Boolean))];

    container.innerHTML = categoryList.map((cat, index) => `
        <button class="filter-chip ${cat === activeCategory ? "active" : ""}" onclick="setCategory(${index})">
            ${escapeHtml(cat)}
        </button>
    `).join("");
}

function setCategory(index) {
    const category = categoryList[index];
    if (category === undefined) return;

    activeCategory = category;
    renderCategoryFilters();

    currentItemsList = activeCategory === "All"
        ? allItems
        : allItems.filter(item => item.category === activeCategory);

    currentPage = 1;
    renderPaginatedItems();
}

function renderPaginatedItems() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsToDisplay = currentItemsList.slice(startIndex, endIndex);

    displayItems(itemsToDisplay);
    renderPaginationControls();
    updateResultsCount();
}

function updateResultsCount() {
    const el = document.getElementById("resultsCount");
    if (!el) return;

    const total = currentItemsList.length;
    if (total === 0) {
        el.textContent = "";
        return;
    }

    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(start + itemsPerPage - 1, total);
    el.textContent = `${start}\u2013${end} of ${total}`;
}

function displayItems(items = []) {
    const itemList = document.getElementById("itemList");
    if (!itemList) return;

    itemList.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
        itemList.innerHTML = "<p class=\"state-msg\">No items found.</p>";
        return;
    }

    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "item-card";

        const itemImage = item.image || FALLBACK_IMG;

        card.innerHTML = `
            <div class="item-header-row" style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <img src="${escapeHtml(itemImage)}" alt="${escapeHtml(item.name)}" class="item-thumbnail" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
                <h3 style="margin: 0; font-size: 1.1rem;">${escapeHtml(item.name)}</h3>
            </div>
            <div class="item-price">${escapeHtml(item.price)} Gold</div>
            <div class="item-category">${escapeHtml(item.category)}</div>
            
            ${renderCardStats(item)}

            <p>${escapeHtml(item.description)}</p>
            <button onclick="viewItem(${Number(item.id)})">
                View Details
            </button>
        `;

        itemList.appendChild(card);
    });
}

function renderPaginationControls() {
    let paginationContainer = document.getElementById("paginationControls");
    
    if (!paginationContainer) {
        paginationContainer = document.createElement("div");
        paginationContainer.id = "paginationControls";
        paginationContainer.className = "pagination-controls";
        const itemList = document.getElementById("itemList");
        if (itemList) {
            itemList.after(paginationContainer);
        }
    }

    const totalPages = Math.ceil(currentItemsList.length / itemsPerPage) || 1;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = "";
        return;
    }

    let buttonsHTML = "";

    buttonsHTML += `
        <button 
            class="prev-btn" 
            onclick="changePage(-1)" 
            ${currentPage <= 1 ? "disabled" : ""}>
            &lsaquo; Back
        </button>
    `;

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        buttonsHTML += `
            <button 
                class="page-num ${i === currentPage ? 'active' : ''}" 
                onclick="goToPage(${i})">
                ${i}
            </button>
        `;
    }

    // Next Button
    buttonsHTML += `
        <button 
            class="next-btn" 
            onclick="changePage(1)" 
            ${currentPage >= totalPages ? "disabled" : ""}>
            Next &rsaquo;
        </button>
    `;

    paginationContainer.innerHTML = buttonsHTML;
}

function goToPage(pageNumber) {
    currentPage = pageNumber;
    renderPaginatedItems();
    window.scrollTo({ top: 0, behavior: "smooth" });
}
function changePage(direction) {
    currentPage += direction;
    renderPaginatedItems();
    window.scrollTo({ top: 0, behavior: "smooth" });
}
let debounceTimer;
function debouncedSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        searchItems();
    }, 300);
}

async function searchItems() {
    const searchInput = document.getElementById("searchInput");

    if (!searchInput) return;

    const query = searchInput.value.trim();

    const clearBtn = document.getElementById("clearBtn");
    if (clearBtn) clearBtn.hidden = !query;

    if (!query) {
        currentItemsList = activeCategory === "All"
            ? allItems
            : allItems.filter(item => item.category === activeCategory);
        currentPage = 1;
        renderPaginatedItems();
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/api/v1/items/search?q=${encodeURIComponent(query)}`,
            FETCH_OPTIONS
        );
        const data = await response.json();
        let results = data.results || [];

        if (activeCategory !== "All") {
            results = results.filter(item => item.category === activeCategory);
        }

        currentItemsList = results;
        currentPage = 1;
        renderPaginatedItems();
    } catch (error) {
        console.error(error);
    }
}

function clearSearch() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";
    searchItems();
    if (searchInput) searchInput.focus();
}

async function viewItem(id) {
    try {
        const response = await fetch(
            `${API_URL}/api/v1/items/${id}`,
            FETCH_OPTIONS
        );

        const item = await response.json();

        const statsList = [
            {
                key: "attackDamage",
                label: "Attack Damage",
                value: item.attackDamage ?? 0,
                unit: ""
            },
            {
                key: "abilityPower",
                label: "Ability Power",
                value: item.abilityPower ?? 0,
                unit: ""
            },
            {
                key: "health",
                label: "Health",
                value: item.health ?? 0,
                unit: ""
            },
            {
                key: "movementSpeed",
                label: "Movement Speed",
                value: item.movementSpeed ?? 0,
                unit: ""
            },
            {
                key: "mana",
                label: "Mana",
                value: item.mana ?? 0,
                unit: ""
            },
            {
                key: "armor",
                label: "Armor",
                value: item.armor ?? 0,
                unit: ""
            },
            {
                key: "magicResist",
                label: "Magic Resist",
                value: item.magicResist ?? 0,
                unit: ""
            },
            {
                key: "attackSpeed",
                label: "Attack Speed",
                value: item.attackSpeed ?? 0,
                unit: "%"
            },
            {
                key: "critChance",
                label: "Crit Chance",
                value: item.critChance ?? 0,
                unit: "%"
            },
            {
                key: "abilityHaste",
                label: "Ability Haste",
                value: item.abilityHaste ?? 0,
                unit: ""
            },
            {
                key: "lifeSteal",
                label: "Life Steal",
                value: item.lifeSteal ?? 0,
                unit: "%"
            },
            {
                key: "lethality",
                label: "Lethality",
                value: item.lethality ?? 0,
                unit: ""
            },
            {
                key: "armorPenetration",
                label: "Armor Pen",
                value: item.armorPenetration ?? 0,
                unit: "%"
            },
            {
                key: "magicPenetration",
                label: "Magic Pen",
                value: item.magicPenetration ?? 0,
                unit: ""
            },
            {
                key: "tenacity",
                label: "Tenacity",
                value: item.tenacity ?? 0,
                unit: "%"
            },
            {
                key: "omnivamp",
                label: "Omnivamp",
                value: item.omnivamp ?? 0,
                unit: "%"
            }
        ];

        // show every stat, zeros included, ordered highest first
        statsList.sort((a, b) => b.value - a.value);

        const statsHTML = statsList.map(stat => {
            const colorClass = getStatColorClass(stat.key);
            const isZero = !stat.value || stat.value <= 0;

            return `
                <div class="${isZero ? "is-zero" : ""}">
                    <span class="${colorClass}">
                        ${escapeHtml(stat.label)}:
                    </span>
                    ${stat.value}${isZero ? "" : stat.unit}
                </div>
            `;
        }).join("");

        const detailsHTML = `
            <div class="modal-details">
                <div><span>Item ID</span><span>${escapeHtml(item.id)}</span></div>
                <div><span>Category</span><span>${escapeHtml(item.category)}</span></div>
                <div><span>Buy Price</span><span class="gold">${escapeHtml(item.price)} Gold</span></div>
                <div><span>Sell Price</span><span class="gold">${escapeHtml(item.sellPrice ?? 0)} Gold</span></div>
            </div>
        `;

        const modalBody = document.getElementById("modalBody");

        if (modalBody) {
            modalBody.innerHTML = `
                <div class="modal-header">

                    <h2 id="modalTitle">${escapeHtml(item.name)}</h2>

                </div>

                ${detailsHTML}

                <div class="modal-stats">
                    ${statsHTML}
                </div>

                <div class="modal-description">
                    <p><strong>Description:</strong></p>
                    <p>${escapeHtml(item.description)}</p>
                </div>
            `;
        }

        const itemModal = document.getElementById("itemModal");

        if (itemModal) {
            itemModal.classList.add("active");
        }

    } catch (error) {
        console.error(error);
        alert("Unable to retrieve item.");
    }
}

function closeModal() {
    const itemModal = document.getElementById("itemModal");
    if (itemModal) {
        itemModal.classList.remove("active");
    }
}

window.addEventListener("click", (event) => {
    const modal = document.getElementById("itemModal");
    if (event.target === modal) {
        closeModal();
    }
});

window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
});

loadItems();