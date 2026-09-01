from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="League of Legends Item API",
    description="A beginner-friendly REST API containing information about League of Legends items.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="League of Legends Item API",
    description="REST API containing League of Legends items categorized by tier with full stats.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ITEM DATA WITH ALL 11 LEAGUE STATS AND REQUESTED CATEGORIES
items = [
    {
        "id": 1,
        "name": "Health Potion",
        "price": 50,
        "category": "Consumable items",
        "attackDamage": 0,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Consumes the potion to restore 120 Health over 15 seconds."
    },
    {
        "id": 2,
        "name": "Doran's Blade",
        "price": 450,
        "category": "Starter items",
        "attackDamage": 10,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 80,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 3,
        "description": "Good starter item for physical damage champions."
    },
    {
        "id": 3,
        "name": "Long Sword",
        "price": 350,
        "category": "Basic items",
        "attackDamage": 10,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Basic component item providing raw Attack Damage."
    },
    {
        "id": 4,
        "name": "Boots of Speed",
        "price": 300,
        "category": "Boot",
        "attackDamage": 0,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 25,
        "lifeSteal": 0,
        "description": "Enhances Movement Speed."
    },
    {
        "id": 5,
        "name": "B. F. Sword",
        "price": 1300,
        "category": "Epic items",
        "attackDamage": 40,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Powerful component item required for high-tier physical damage weapons."
    },
    {
        "id": 6,
        "name": "Infinity Edge",
        "price": 3600,
        "category": "Legendary items",
        "attackDamage": 80,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 25,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "A powerful critical strike item that greatly increases attack damage and critical strike damage."
    }
]

@app.get("/")
def home():
    return {
        "message": "Welcome to the League of Legends Item API!",
        "endpoints": [
            "/items",
            "/items/{id}",
            "/items/search"
        ]
    }

@app.get("/items")
def get_items():
    return {
        "count": len(items),
        "items": items
    }

# SEARCH ENDPOINT (Placed BEFORE /items/{item_id})
@app.get("/items/search")
def search_items(q: str = Query(..., min_length=1)):
    q = q.lower()
    results = []

    for item in items:
        searchable_text = (
            f"{item['name']} "
            f"{item['price']} "
            f"{item['category']} "
            f"{item['description']}"
        ).lower()

        if q in searchable_text:
            results.append(item)

    return {
        "query": q,
        "count": len(results),
        "results": results
    }

@app.get("/items/{item_id}")
def get_item(item_id: int):
    for item in items:
        if item["id"] == item_id:
            return item

    raise HTTPException(
        status_code=404,
        detail="Item not found."
    )
# LEAGUE OF LEGENDS ITEM DATA

items = [
    {
        "id": 1,
        "name": "Health Potion",
        "price": 50,
        "category": "Consumable items",
        "attackDamage": 0,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Consumes the potion to restore 120 Health over 15 seconds."
    },
    {
        "id": 2,
        "name": "Doran's Blade",
        "price": 450,
        "category": "Starter items",
        "attackDamage": 10,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 80,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 3,
        "description": "Good starter item for physical damage champions."
    },
    {
        "id": 3,
        "name": "Long Sword",
        "price": 350,
        "category": "Basic items",
        "attackDamage": 10,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Basic component item providing raw Attack Damage."
    },
    {
        "id": 4,
        "name": "Boots of Speed",
        "price": 300,
        "category": "Boot",
        "attackDamage": 0,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 25,
        "lifeSteal": 0,
        "description": "Enhances Movement Speed."
    },
    {
        "id": 5,
        "name": "B. F. Sword",
        "price": 1300,
        "category": "Epic items",
        "attackDamage": 40,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Powerful component item required for high-tier physical damage weapons."
    },
    {
        "id": 6,
        "name": "Infinity Edge",
        "price": 3600,
        "category": "Legendary items",
        "attackDamage": 80,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 25,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "A powerful critical strike item that greatly increases attack damage and critical strike damage."
    }
]

@app.get("/")
def home():
    return {
        "message": "Welcome to the League of Legends Item API!",
        "endpoints": [
            "/items",
            "/items/{id}",
            "/items/search"
        ]
    }

@app.get("/items")
def get_items():
    return {
        "count": len(items),
        "items": items
    }

# SEARCH ITEMS (Must come BEFORE /items/{item_id})
@app.get("/items/search")
def search_items(q: str = Query(..., min_length=1)):
    q = q.lower()
    results = []

    for item in items:
        searchable_text = (
            f"{item['name']} "
            f"{item['price']} "
            f"{item['category']} "
            f"{item['description']}"
        ).lower()

        if q in searchable_text:
            results.append(item)

    return {
        "query": q,
        "count": len(results),
        "results": results
    }

# GET SINGLE ITEM BY ID
@app.get("/items/{item_id}")
def get_item(item_id: int):
    for item in items:
        if item["id"] == item_id:
            return item

    raise HTTPException(
        status_code=404,
        detail="Item not found."
    )


