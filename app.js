const API_URL = "https://my-fastapi-g.vercel.app";

// PAGINATION & DATA STATE
let currentPage = 1;
const itemsPerPage = 9;
let currentItemsList = [];

// HELPER FUNCTION: GET CSS CLASS FOR STAT COLOR CODING
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

// RENDER NON-ZERO STAT PREVIEWS ON CARDS (COLOR CODED)
function renderCardStats(item) {
    const statLabels = {
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

    let activeStats = [];

    for (let key in statLabels) {
        if (item[key] && item[key] > 0) {
            let unit = statLabels[key].includes("%") ? "%" : "";
            let cleanLabel = statLabels[key].replace("%", "");
            let colorClass = getStatColorClass(key);
            activeStats.push(`<span class="${colorClass}">+${item[key]}${unit} ${cleanLabel}</span>`);
        }
    }

    if (activeStats.length === 0) return "";

    return `<div class="card-stats-preview">${activeStats.join(" • ")}</div>`;
}

// LOAD ALL ITEMS
async function loadItems() {
    try {
        const response = await fetch(`${API_URL}/items`);
        const data = await response.json();
        
        currentItemsList = data.items || [];
        currentPage = 1;
        renderPaginatedItems();
    } catch (error) {
        console.error(error);
        const itemList = document.getElementById("itemList");
        if (itemList) {
            itemList.innerHTML = "<p>Unable to connect to the API.</p>";
        }
    }
}

// SLICE CURRENT DATASET & RENDER PAGE CARDS
function renderPaginatedItems() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsToDisplay = currentItemsList.slice(startIndex, endIndex);

    displayItems(itemsToDisplay);
    renderPaginationControls();
}

// RENDER ITEM CARDS IN GRID (IMAGE & NAME SIDE-BY-SIDE)
function displayItems(items = []) {
    const itemList = document.getElementById("itemList");
    if (!itemList) return;

    itemList.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
        itemList.innerHTML = "<p>No items found.</p>";
        return;
    }

    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "item-card";

        const itemImage = item.image || "https://via.placeholder.com/64";

        card.innerHTML = `
            <div class="item-header-row" style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <img src="${itemImage}" alt="${item.name}" class="item-thumbnail" style="width: 48px; height: 48px; object-fit: contain;" onerror="this.src='https://via.placeholder.com/64'">
                <h3 style="margin: 0; font-size: 1.1rem;">${item.name}</h3>
            </div>
            <div class="item-price">${item.price} Gold</div>
            <div class="item-category">${item.category}</div>
            
            ${renderCardStats(item)}

            <p>${item.description}</p>
            <button onclick="viewItem('${item.id}')">
                View Details
            </button>
        `;

        itemList.appendChild(card);
    });
}

// RENDER NUMBERED PAGINATION CONTROLS (MAX 5 NUMBERS + BACK/NEXT)
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
    let buttonsHTML = "";

    // Back / Previous Button
    buttonsHTML += `
        <button 
            class="prev-btn" 
            onclick="changePage(-1)" 
            ${currentPage <= 1 ? "disabled" : ""}>
            &lsaquo; Back
        </button>
    `;

    // Calculate window of up to 5 page numbers
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

// DEBOUNCE TIMER & HANDLER
let debounceTimer;

function debouncedSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        searchItems();
    }, 300);
}

// SEARCH FUNCTION (FILTERS BY NAME OR CATEGORY CLIENT-SIDE)
async function searchItems() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
        loadItems();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/items`);
        const data = await response.json();
        const allItems = data.items || [];

        currentItemsList = allItems.filter(item => {
            const nameMatch = item.name && item.name.toLowerCase().includes(query);
            const categoryMatch = item.category && item.category.toLowerCase().includes(query);
            return nameMatch || categoryMatch;
        });

        currentPage = 1;
        renderPaginatedItems();
    } catch (error) {
        console.error(error);
    }
}

// VIEW ITEM MODAL DETAILS (SORTED & COLOR CODED)
async function viewItem(id) {
    try {
        const response = await fetch(`${API_URL}/items/${id}`);
        const item = await response.json();

        const statsList = [
            { key: "attackDamage", label: "Attack Damage", value: item.attackDamage ?? 0, unit: "" },
            { key: "abilityPower", label: "Ability Power", value: item.abilityPower ?? 0, unit: "" },
            { key: "health", label: "Health", value: item.health ?? 0, unit: "" },
            { key: "movementSpeed", label: "Movement Speed", value: item.movementSpeed ?? 0, unit: "" },
            { key: "mana", label: "Mana", value: item.mana ?? 0, unit: "" },
            { key: "armor", label: "Armor", value: item.armor ?? 0, unit: "" },
            { key: "magicResist", label: "Magic Resist", value: item.magicResist ?? 0, unit: "" },
            { key: "attackSpeed", label: "Attack Speed", value: item.attackSpeed ?? 0, unit: "%" },
            { key: "critChance", label: "Crit Chance", value: item.critChance ?? 0, unit: "%" },
            { key: "abilityHaste", label: "Ability Haste", value: item.abilityHaste ?? 0, unit: "" },
            { key: "lifeSteal", label: "Life Steal", value: item.lifeSteal ?? 0, unit: "%" },
            { key: "lethality", label: "Lethality", value: item.lethality ?? 0, unit: "" },
            { key: "armorPenetration", label: "Armor Pen", value: item.armorPenetration ?? 0, unit: "%" },
            { key: "magicPenetration", label: "Magic Pen", value: item.magicPenetration ?? 0, unit: "" },
            { key: "tenacity", label: "Tenacity", value: item.tenacity ?? 0, unit: "%" },
            { key: "omnivamp", label: "Omnivamp", value: item.omnivamp ?? 0, unit: "%" }
        ];

        statsList.sort((a, b) => b.value - a.value);

        const statsHTML = statsList.map(stat => {
            const colorClass = getStatColorClass(stat.key);
            return `<div><span class="${colorClass}">${stat.label}:</span> ${stat.value}${stat.unit}</div>`;
        }).join("");

        const modalBody = document.getElementById("modalBody");
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="modal-header">
                    <h2>${item.name}</h2>
                    <div class="item-price" style="margin-top: 5px;">${item.price} Gold</div>
                    <div class="item-category" style="margin-top: 2px;">Category: ${item.category}</div>
                </div>
                
                <div class="modal-stats">
                    ${statsHTML}
                </div>

                <div class="modal-description">
                    <p><strong>Description:</strong></p>
                    <p>${item.description}</p>
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

// CLOSE MODAL
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

loadItems();
