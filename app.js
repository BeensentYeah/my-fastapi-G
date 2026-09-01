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

// RENDER ITEM CARDS IN GRID
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
            <p>${item.description}</p>
            <button onclick="viewItem('${item.id}')">
                View Details
            </button>
        `;

        itemList.appendChild(card);
    });
}

// DEBOUNCE TIMER & HANDLER (Triggers instant search after 300ms pause)
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

    // If input is empty, reset grid to show all items
    if (!query) {
        loadItems();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/items/search?q=${encodeURIComponent(query)}`);
        
        // Handle failed API requests gracefully
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

// FETCH ITEM DETAILS & OPEN MODAL
async function viewItem(id) {
    try {
        const response = await fetch(`${API_URL}/items/${id}`);
        const item = await response.json();

        const modalBody = document.getElementById("modalBody");
        modalBody.innerHTML = `
            <div class="modal-header">
                <h2>${item.name}</h2>
                <div class="item-price" style="margin-top: 5px;">${item.price} Gold</div>
            </div>
            
            <div class="modal-stats">
                <div><span>Category:</span> ${item.category}</div>
                <div><span>Attack Damage:</span> ${item.attackDamage}</div>
                <div><span>Ability Power:</span> ${item.abilityPower}</div>
                <div><span>Attack Speed:</span> ${item.attackSpeed}%</div>
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

// CLOSE MODAL WHEN CLICKING OUTSIDE ON THE BACKDROP
window.addEventListener("click", (event) => {
    const modal = document.getElementById("itemModal");
    if (event.target === modal) {
        closeModal();
    }
});

// INITIAL FETCH ON PAGE LOAD
loadItems();