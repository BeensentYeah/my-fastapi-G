const API_URL = "https://my-fastapi-g.vercel.app/";


async function loadItems() {

    try {

        const response = await fetch(`${API_URL}/items`);

        const data = await response.json();

        displayItems(data.items);

    }
    catch (error) {

        console.error(error);

        document.getElementById("itemList").innerHTML =
            "Unable to connect to the API.";

    }
}


function displayItems(items) {

    const itemList = document.getElementById("itemList");

    itemList.innerHTML = "";


    items.forEach(item => {

        const card = document.createElement("div");

        card.className = "item-card";


        card.innerHTML = `
            <div class="item-price">${item.price} Gold</div>

            <h3>${item.name}</h3>

            <p class="item-category">${item.category}</p>

            <p>
                ⚔️ Attack Damage:
                ${item.attackDamage}
            </p>

            <p>
                ✨ Ability Power:
                ${item.abilityPower}
            </p>

            <p>
                ⚡ Attack Speed:
                ${item.attackSpeed}%
            </p>

            <p>${item.description}</p>

            <button onclick="viewItem(${item.id})">
                View Details
            </button>
        `;


        itemList.appendChild(card);

    });
}



async function viewItem(id) {

    try {

        const response =
            await fetch(`${API_URL}/items/${id}`);

        const item = await response.json();


        alert(`
${item.name}

Price:
${item.price} Gold

Category:
${item.category}

Attack Damage:
${item.attackDamage}

Ability Power:
${item.abilityPower}

Attack Speed:
${item.attackSpeed}%

Description:
${item.description}
        `);

    }
    catch (error) {

        console.error(error);

        alert("Unable to retrieve item.");

    }
}




async function searchItems() {

    const query =
        document.getElementById("searchInput").value;


    if (!query) {

        loadItems();

        return;

    }


    try {

        const response =
            await fetch(
                `${API_URL}/items/search?q=${encodeURIComponent(query)}`
            );


        const data = await response.json();


        displayItems(data.results);

    }
    catch (error) {

        console.error(error);

        alert("Search failed.");

    }
}



loadItems();
