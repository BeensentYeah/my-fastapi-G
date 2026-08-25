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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# LEAGUE OF LEGENDS ITEM DATA


items = [
    {
        "id": 1,
        "name": "Infinity Edge",
        "price": 3600,
        "category": "Critical Strike",
        "attackDamage": 75,
        "abilityPower": 0,
        "attackSpeed": 0,
        "description": "A powerful critical strike item that greatly increases attack damage and critical strike damage."
    },
    {
        "id": 2,
        "name": "Bloodthirster",
        "price": 3400,
        "category": "Attack Damage",
        "attackDamage": 80,
        "abilityPower": 0,
        "attackSpeed": 0,
        "description": "A powerful offensive item that provides attack damage and life steal."
    },
    {
        "id": 3,
        "name": "Rabadon's Deathcap",
        "price": 3600,
        "category": "Ability Power",
        "attackDamage": 0,
        "abilityPower": 130,
        "attackSpeed": 0,
        "description": "A powerful mage item that massively increases ability power."
    },
    {
        "id": 4,
        "name": "Guardian Angel",
        "price": 3200,
        "category": "Attack Damage",
        "attackDamage": 55,
        "abilityPower": 0,
        "attackSpeed": 0,
        "description": "An offensive defensive item that can revive its wearer after taking fatal damage."
    },
    {
        "id": 5,
        "name": "Trinity Force",
        "price": 3333,
        "category": "Fighter",
        "attackDamage": 36,
        "abilityPower": 0,
        "attackSpeed": 30,
        "description": "A versatile fighter item that provides attack damage, attack speed, movement speed, and powerful on-hit effects."
    }
]



# HOME


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



# GET ALL ITEMS


@app.get("/items")
def get_items():
    return {
        "count": len(items),
        "items": items
    }



# GET ONE ITEM


@app.get("/items/{item_id}")
def get_item(item_id: int):

    for item in items:
        if item["id"] == item_id:
            return item

    raise HTTPException(
        status_code=404,
        detail="Item not found."
    )



# SEARCH ITEMS


@app.get("/items/search")
def search_items(q: str = Query(..., min_length=1)):

    q = q.lower()

    results = []

    for item in items:

        searchable_text = (
            f"{item['name']} "
            f"{item['price']} "
            f"{item['category']} "
            f"{item['attackDamage']} "
            f"{item['abilityPower']} "
            f"{item['attackSpeed']} "
            f"{item['description']}"
        ).lower()

        if q in searchable_text:
            results.append(item)

    return {
        "query": q,
        "count": len(results),
        "results": results
    }
