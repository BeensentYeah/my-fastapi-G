const API_URL = "https://my-fastapi-g.vercel.app";

// Helper function to dynamically extract and render non-zero stats
function renderCardStats(item) {
    const statLabels = {
        attackDamage: "AD",
        abilityPower: "AP",
        attackSpeed: "AS%",
        health: "Health",
        mana: "Mana",
        armor: "Armor",
        magicResist: "MR",
        critChance: "Crit%",
        abilityHaste: "AH",
        movementSpeed: "MS",
        lifeSteal: "Lifesteal%",
        lethality: "Lethality",
        armorPenetration: "Armor Pen%",
        magicPenetration: "Magic Pen",
        tenacity: "Tenacity%",
        omnivamp: "Omnivamp%"
    };

    let activeStats = [];

    // Loop through defined stats
    for (let key in statLabels) {
        if (item[key] && item[key] > 0) {
            let unit = statLabels[key].includes("%") ? "%" : "";
            let cleanLabel = statLabels[key].replace("%", "");
            activeStats.push(`<span>+${item[key]}${unit} ${cleanLabel}</span>`);
        }
    }

    // Check for any unique custom stat added to a specific item
    const standardKeys = [...Object.keys(statLabels), "id", "name", "price", "category", "description"];
    for (let key in item) {
        if (!standardKeys.includes(key) && typeof item[key] === "number" && item[key] > 0) {
            let formattedLabel = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase());
            activeStats.push(`<span>+${item[key]} ${formattedLabel}</span>`);
        }
    }

    if (activeStats.length === 0) return "";

    return `<div class="card-stats-preview">${activeStats.join(" • ")}</div>`;
}

// Fetch and display all items on page load
async function fetchItems() {
    try {
        const response = await fetch(`${API_URL}/items`);
        const data = await response.json();
        displayItems(data.items);
    } catch (error) {
        console.error("Error fetching items:", error);
        document.getElementById("item-container").innerHTML = `<p class="error">Failed to load items. Check console for details.</p>`;
    }
}

// Display items inside cards
function displayItems(itemList) {
    const container = document.getElementById("item-container");
    container.innerHTML = "";

    if (!itemList || itemList.length === 0) {
        container.innerHTML = "<p>No items found.</p>";
        return;
    }

    itemList.forEach(item => {
        const card = document.createElement("div");
        card.className = "item-card";

        card.innerHTML = `
            <div class="item-price">${item.price} Gold</div>
            <h3>${item.name}</h3>
            <div class="item-category">${item.category}</div>
            
            ${renderCardStats(item)}
            
            <p>${item.description}</p>
            <button onclick="viewItem(${item.id})">View Details</button>
        `;

        container.appendChild(card);
    });
}

// Search items using API endpoint
async function searchItems() {
    const query = document.getElementById("search-input").value.trim();

    if (!query) {
        fetchItems();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/items/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        displayItems(data.results);
    } catch (error) {
        console.error("Error searching items:", error);
    }
}

// Display modal view details for a specific item
async function viewItem(id) {
    try {
        const response = await fetch(`${API_URL}/items/${id}`);
        const item = await response.json();

        const modalContainer = document.getElementById("modal-container");
        modalContainer.innerHTML = `
            <div class="modal-backdrop" onclick="closeModal()"></div>
            <div class="modal-content">
                <span class="close-btn" onclick="closeModal()">&times;</span>
                <h2>${item.name}</h2>
                <div class="item-category">${item.category}</div>
                <div class="item-price">${item.price} Gold</div>
                <p class="modal-description">${item.description}</p>
                
                <h3>Item Stats</h3>
                <div class="modal-stats">
                    <div><span>Attack Damage:</span> ${item.attackDamage ?? 0}</div>
                    <div><span>Ability Power:</span> ${item.abilityPower ?? 0}</div>
                    <div><span>Attack Speed:</span> ${item.attackSpeed ?? 0}%</div>
                    <div><span>Health:</span> ${item.health ?? 0}</div>
                    <div><span>Mana:</span> ${item.mana ?? 0}</div>
                    <div><span>Armor:</span> ${item.armor ?? 0}</div>
                    <div><span>Magic Resist:</span> ${item.magicResist ?? 0}</div>
                    <div><span>Crit Chance:</span> ${item.critChance ?? 0}%</div>
                    <div><span>Ability Haste:</span> ${item.abilityHaste ?? 0}</div>
                    <div><span>Movement Speed:</span> ${item.movementSpeed ?? 0}</div>
                    <div><span>Life Steal:</span> ${item.lifeSteal ?? 0}%</div>
                    <div><span>Lethality:</span> ${item.lethality ?? 0}</div>
                    <div><span>Armor Pen:</span> ${item.armorPenetration ?? 0}%</div>
                    <div><span>Magic Pen:</span> ${item.magicPenetration ?? 0}</div>
                    <div><span>Tenacity:</span> ${item.tenacity ?? 0}%</div>
                    <div><span>Omnivamp:</span> ${item.omnivamp ?? 0}%</div>
                </div>
            </div>
        `;
        modalContainer.style.display = "block";
    } catch (error) {
        console.error("Error fetching item details:", error);
    }
}

// Close item details modal
function closeModal() {
    const modalContainer = document.getElementById("modal-container");
    if (modalContainer) {
        modalContainer.style.display = "none";
    }
}

// Initial fetch when window loads
window.onload = fetchItems;