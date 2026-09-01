const API_URL = "https://my-fastapi-g.vercel.app";

// LOAD ALL ITEMS
async function loadItems() {
    try {
        const response = await fetch(`${API_URL}/items`);
        const data = await response.json();
        
        displayItems(data.items || []);
    } catch (error) {
        console.error(error);
        document.getElementById("itemList").innerHTML = "Unable to connect to the API.";
    }
}

// RENDER ITEM CARDS
function displayItems(items = []) {
    const itemList = document.getElementById("itemList");
    itemList.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
        itemList.innerHTML = "<p>No items found.</p>";
        return;
    }

    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "item-card";

        card.innerHTML = `
            <div class="item-price">${item.price} Gold</div>
            <h3>${item.name}</h3>
            <div class="item-category">${item.category}</div>
            <p>${item.description}</p>
            <button onclick="viewItem('${item.id}')">
                View Details
            </button>
        `;

        itemList.appendChild(card);
    });
}

// DEBOUNCE TIMER & HANDLER
let debounceTimer;

function debouncedSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        searchItems();
    }, 300);
}

// SEARCH FUNCTION
async function searchItems() {
    const query = document.getElementById("searchInput").value.trim();

    if (!query) {
        loadItems();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/items/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            displayItems([]);
            return;
        }

        const data = await response.json();
        displayItems(data.results || []);
    } catch (error) {
        console.error(error);
    }
}

// VIEW ITEM MODAL DETAILS (Displays every single stat)
async function viewItem(id) {
    try {
        const response = await fetch(`${API_URL}/items/${id}`);
        const item = await response.json();

        const modalBody = document.getElementById("modalBody");
        modalBody.innerHTML = `
            <div class="modal-header">
                <h2>${item.name}</h2>
                <div class="item-price" style="margin-top: 5px;">${item.price} Gold</div>
                <div class="item-category" style="margin-top: 2px;">Category: ${item.category}</div>
            </div>
            
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
            </div>

            <div class="modal-description">
                <p><strong>Description:</strong></p>
                <p>${item.description}</p>
            </div>
        `;

        document.getElementById("itemModal").classList.add("active");
    } catch (error) {
        console.error(error);
        alert("Unable to retrieve item.");
    }
}

// CLOSE MODAL
function closeModal() {
    document.getElementById("itemModal").classList.remove("active");
}

// CLOSE MODAL WHEN CLICKING OUTSIDE
window.addEventListener("click", (event) => {
    const modal = document.getElementById("itemModal");
    if (event.target === modal) {
        closeModal();
    }
});

loadItems();