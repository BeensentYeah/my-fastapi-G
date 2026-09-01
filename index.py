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

# LEAGUE OF LEGENDS ITEM DATA
items = [
    # --- STARTER ITEMS ---
    {
        "id": 1,
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
        "lifeSteal": 3.5,
        "description": "Good starter item for physical damage champions."
    },

    # --- CONSUMABLE ITEMS ---
    {
        "id": 2,
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

    # --- BASIC ITEMS ---
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

    # --- BOOTS ---
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

    # --- EPIC ITEMS ---
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

    # --- LEGENDARY ITEMS ---
    {
        "id": 6,
        "name": "Infinity Edge",
        "price": 3400,
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
        "description": "Massively boosts attack damage and critical strike damage."
    },
    {
        "id": 7,
        "name": "Bloodthirster",
        "price": 3400,
        "category": "Legendary items",
        "attackDamage": 80,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 18,
        "description": "Grants high attack damage, lifesteal, and a shield at full health."
    },
    {
        "id": 8,
        "name": "Rabadon's Deathcap",
        "price": 3600,
        "category": "Legendary items",
        "attackDamage": 0,
        "abilityPower": 140,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Increases total Ability Power by 35%."
    },
    {
        "id": 9,
        "name": "Guardian Angel",
        "price": 3200,
        "category": "Legendary items",
        "attackDamage": 55,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 45,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Revives user upon taking fatal damage."
    },
    {
        "id": 10,
        "name": "Trinity Force",
        "price": 3333,
        "category": "Legendary items",
        "attackDamage": 45,
        "abilityPower": 0,
        "attackSpeed": 33,
        "health": 300,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 20,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Empowers auto-attacks after casting abilities."
    },
    {
        "id": 11,
        "name": "Zhonya's Hourglass",
        "price": 3250,
        "category": "Legendary items",
        "attackDamage": 0,
        "abilityPower": 120,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 50,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Puts user in Stasis for 2.5 seconds, becoming invulnerable."
    },
    {
        "id": 12,
        "name": "Kraken Slayer",
        "price": 3100,
        "category": "Legendary items",
        "attackDamage": 50,
        "abilityPower": 0,
        "attackSpeed": 40,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 7,
        "lifeSteal": 0,
        "description": "Deals bonus damage on every third auto-attack."
    },
    {
        "id": 13,
        "name": "Shadowflame",
        "price": 3200,
        "category": "Legendary items",
        "attackDamage": 0,
        "abilityPower": 115,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Magic damage and damage over time critically strike low-health enemies."
    },
    {
        "id": 14,
        "name": "Sterak's Gage",
        "price": 3200,
        "category": "Legendary items",
        "attackDamage": 0,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 400,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Grants bonus AD based on base AD and a huge shield when low health."
    },
    {
        "id": 15,
        "name": "Thornmail",
        "price": 2700,
        "category": "Legendary items",
        "attackDamage": 0,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 350,
        "mana": 0,
        "armor": 70,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Reflects magic damage back to attackers and applies Grievous Wounds."
    },
    {
        "id": 16,
        "name": "Bork (Blade of the Ruined King)",
        "price": 3200,
        "category": "Legendary items",
        "attackDamage": 50,
        "abilityPower": 0,
        "attackSpeed": 25,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 10,
        "description": "On-hit attacks deal current health percent damage and steal movement speed."
    },
    {
        "id": 17,
        "name": "Lich Bane",
        "price": 3100,
        "category": "Legendary items",
        "attackDamage": 0,
        "abilityPower": 100,
        "attackSpeed": 0,
        "health": 0,
        "mana": 0,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 15,
        "movementSpeed": 8,
        "lifeSteal": 0,
        "description": "After casting an ability, your next auto-attack deals bonus AP damage."
    },
    {
        "id": 18,
        "name": "Lord Dominik's Regards",
        "price": 3000,
        "category": "Legendary items",
        "attackDamage": 45,
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
        "description": "Provides armor penetration against high-armor targets."
    },
    {
        "id": 19,
        "name": "Jak'Sho, The Protean",
        "price": 3200,
        "category": "Legendary items",
        "attackDamage": 0,
        "abilityPower": 0,
        "attackSpeed": 0,
        "health": 300,
        "mana": 0,
        "armor": 50,
        "magicResist": 50,
        "critChance": 0,
        "abilityHaste": 0,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Gains increasing Armor and Magic Resist while in combat with champions."
    },
    {
        "id": 20,
        "name": "Ludens Companion",
        "price": 3000,
        "category": "Legendary items",
        "attackDamage": 0,
        "abilityPower": 90,
        "attackSpeed": 0,
        "health": 0,
        "mana": 600,
        "armor": 0,
        "magicResist": 0,
        "critChance": 0,
        "abilityHaste": 20,
        "movementSpeed": 0,
        "lifeSteal": 0,
        "description": "Fires charges at targets upon dealing ability damage."
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