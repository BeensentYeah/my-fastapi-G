"""
League of Legends Item API
==========================

The item data lives in a Supabase (PostgreSQL) database. Nothing is hardcoded
in this file: every request reads from or writes to the database.

Security
--------
* No credentials in this file. Everything comes from environment variables.
* Reads use the Supabase PUBLISHABLE key, which goes through the `anon` database
  role, so the Row Level Security policies apply: it can read and nothing else.
* Writes use the Supabase SECRET key, which bypasses Row Level Security. It is
  only ever used inside this server, and only on endpoints that require the
  admin key.
* Reading requires the `x-api-key` header. Creating, updating and deleting
  require `x-api-key` AND `x-admin-key`.
* Database errors are logged on the server but never returned to the caller,
  so table names, SQL and connection details are not leaked.

Environment variables (see .env.example)
----------------------------------------
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, API_KEY, ADMIN_API_KEY
"""

import logging
import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator
from supabase import Client, create_client

logger = logging.getLogger("item-api")
logging.basicConfig(level=logging.INFO)

API_VERSION = "2.0"

app = FastAPI(
    title="LoL Item API",
    description="A REST API for League of Legends items, backed by a Supabase PostgreSQL database.",
    version=API_VERSION,
)

# ---------------------------------------------------------------------
# Which browser origins may call this API.
#
# CORS is a rule browsers enforce, not an access control: curl, Postman and
# any server ignore it entirely. Naming this project's own pages stops
# ANOTHER website's JavaScript from using this API inside a visitor's
# browser, which is worth doing because the read key is visible in the
# three sites' source. The controls that actually restrict access are Row
# Level Security on the database (the anon role may only SELECT) and the
# administrator key required by every write endpoint.
#
# The list can be changed without editing code: set ALLOWED_ORIGINS in
# Vercel to a comma-separated list of origins. Setting it to "*" restores
# the old allow-everyone behaviour.
#
# Note: a page opened straight from disk has the origin "null", so local
# file:// testing of anything that calls this API no longer works. Test on
# the deployed sites instead.
# ---------------------------------------------------------------------

DEFAULT_ALLOWED_ORIGINS = [
    "https://my-fastapi-g-1stwebsite.vercel.app",   # Item Shop
    "https://my-fastapi-g-2ndwebsite.vercel.app",   # Item Rift
    "https://my-fastapi-g-3rdwebsite.vercel.app",   # Itemdle
    "https://my-fastapi-g-api.vercel.app",          # the three sites are served here too
]


def allowed_origins() -> List[str]:
    """ALLOWED_ORIGINS from the environment, falling back to the four above."""
    configured = [
        origin.strip().rstrip("/")
        for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    return configured or DEFAULT_ALLOWED_ORIGINS


ALLOWED_ORIGINS = allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,      # no cookies are used
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    # Only the headers the sites and the admin tools actually send.
    allow_headers=["x-api-key", "x-admin-key", "content-type"],
)


# =====================================================================
# 1. CONFIGURATION — read from the environment, never hardcoded
# =====================================================================

def _env(name: str) -> str:
    """Return a required environment variable, or fail with a safe message."""
    value = os.environ.get(name)
    if not value:
        logger.error("Missing required environment variable: %s", name)
        raise HTTPException(status_code=500, detail="Server configuration error.")
    return value


@lru_cache(maxsize=1)
def read_client() -> Client:
    """Supabase client for reads. Publishable key -> anon role -> RLS applies."""
    return create_client(_env("SUPABASE_URL"), _env("SUPABASE_PUBLISHABLE_KEY"))


@lru_cache(maxsize=1)
def write_client() -> Client:
    """Supabase client for writes. Secret key -> bypasses RLS. Server-side only."""
    return create_client(_env("SUPABASE_URL"), _env("SUPABASE_SECRET_KEY"))


# =====================================================================
# 2. AUTHENTICATION
# =====================================================================

def verify_api_key(x_api_key: Optional[str] = Header(default=None)):
    """Every /api/v1 endpoint needs this. 401 when it is missing or wrong."""
    if x_api_key != _env("API_KEY"):
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")
    return True


def verify_admin_key(
    _: bool = Depends(verify_api_key),
    x_admin_key: Optional[str] = Header(default=None),
):
    """
    Create / update / delete need this as well as the normal API key.
    401 means "not identified", 403 means "identified but not allowed to write".
    """
    if x_admin_key != _env("ADMIN_API_KEY"):
        raise HTTPException(
            status_code=403,
            detail="This action requires an administrator key.",
        )
    return True


# =====================================================================
# 3. DATABASE ERRORS -> safe HTTP responses
# =====================================================================

# PostgreSQL error codes we can turn into a helpful message.
_CONSTRAINT_CODES = {
    "23503": "Unknown category.",
    "23514": "A value is outside the allowed range.",
    "23502": "A required field is missing.",
    "22P02": "A value has the wrong type.",
    "22003": "A number is too large.",
}


def db_error(exc: Exception, action: str) -> HTTPException:
    """
    Log the real error, return a generic one.
    The caller never sees SQL, table names, hostnames or stack traces.
    """
    code = str(getattr(exc, "code", "") or "")
    logger.error("Database error during %s (code=%s): %s", action, code, exc)

    if code == "23505":
        return HTTPException(status_code=409, detail="An item with that name already exists.")
    if code in _CONSTRAINT_CODES:
        return HTTPException(status_code=400, detail=_CONSTRAINT_CODES[code])

    text = str(exc).lower()
    if any(word in text for word in ("connect", "timeout", "timed out", "network", "temporarily")):
        return HTTPException(status_code=503, detail="The database is temporarily unavailable. Please try again.")

    return HTTPException(status_code=500, detail="An unexpected error occurred.")


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request, exc: RequestValidationError):
    """Malformed input returns 400 with a readable message instead of FastAPI's 422."""
    problems = []
    for err in exc.errors():
        field = ".".join(str(p) for p in err.get("loc", []) if p not in ("body", "query", "path"))
        problems.append(f"{field or 'request'}: {err.get('msg', 'invalid value')}")
    return JSONResponse(status_code=400, content={"detail": "Invalid input. " + "; ".join(problems)})


# =====================================================================
# 4. DATA MODELS — validation happens here, before anything is stored
# =====================================================================

STAT_FIELDS = {
    "attackDamage": "attack_damage",
    "abilityPower": "ability_power",
    "attackSpeed": "attack_speed",
    "health": "health",
    "mana": "mana",
    "armor": "armor",
    "magicResist": "magic_resist",
    "critChance": "crit_chance",
    "abilityHaste": "ability_haste",
    "movementSpeed": "movement_speed",
    "lifeSteal": "life_steal",
    "armorPenetration": "armor_penetration",
    "magicPenetration": "magic_penetration",
    "tenacity": "tenacity",
    "omnivamp": "omnivamp",
}


class ItemCreate(BaseModel):
    """Body for POST and PUT. Every field is checked before it reaches the database."""
    model_config = {"extra": "forbid"}      # reject unknown fields instead of ignoring them

    name: str = Field(min_length=1, max_length=100)
    price: int = Field(ge=0, le=100000)
    sellPrice: int = Field(ge=0, le=100000)
    category: str = Field(min_length=1, max_length=50)
    image: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1, max_length=1000)

    attackDamage: float = Field(default=0, ge=0, le=10000)
    abilityPower: float = Field(default=0, ge=0, le=10000)
    attackSpeed: float = Field(default=0, ge=0, le=10000)
    health: float = Field(default=0, ge=0, le=10000)
    mana: float = Field(default=0, ge=0, le=10000)
    armor: float = Field(default=0, ge=0, le=10000)
    magicResist: float = Field(default=0, ge=0, le=10000)
    critChance: float = Field(default=0, ge=0, le=10000)
    abilityHaste: float = Field(default=0, ge=0, le=10000)
    movementSpeed: float = Field(default=0, ge=0, le=10000)
    lifeSteal: float = Field(default=0, ge=0, le=10000)
    armorPenetration: float = Field(default=0, ge=0, le=10000)
    magicPenetration: float = Field(default=0, ge=0, le=10000)
    tenacity: float = Field(default=0, ge=0, le=10000)
    omnivamp: float = Field(default=0, ge=0, le=10000)

    @model_validator(mode="after")
    def sell_price_not_above_price(self):
        if self.sellPrice > self.price:
            raise ValueError("sellPrice cannot be greater than price")
        return self


class ItemPatch(BaseModel):
    """Body for PATCH. Everything optional: only the fields sent are changed."""
    model_config = {"extra": "forbid"}

    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    price: Optional[int] = Field(default=None, ge=0, le=100000)
    sellPrice: Optional[int] = Field(default=None, ge=0, le=100000)
    category: Optional[str] = Field(default=None, min_length=1, max_length=50)
    image: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = Field(default=None, min_length=1, max_length=1000)

    attackDamage: Optional[float] = Field(default=None, ge=0, le=10000)
    abilityPower: Optional[float] = Field(default=None, ge=0, le=10000)
    attackSpeed: Optional[float] = Field(default=None, ge=0, le=10000)
    health: Optional[float] = Field(default=None, ge=0, le=10000)
    mana: Optional[float] = Field(default=None, ge=0, le=10000)
    armor: Optional[float] = Field(default=None, ge=0, le=10000)
    magicResist: Optional[float] = Field(default=None, ge=0, le=10000)
    critChance: Optional[float] = Field(default=None, ge=0, le=10000)
    abilityHaste: Optional[float] = Field(default=None, ge=0, le=10000)
    movementSpeed: Optional[float] = Field(default=None, ge=0, le=10000)
    lifeSteal: Optional[float] = Field(default=None, ge=0, le=10000)
    armorPenetration: Optional[float] = Field(default=None, ge=0, le=10000)
    magicPenetration: Optional[float] = Field(default=None, ge=0, le=10000)
    tenacity: Optional[float] = Field(default=None, ge=0, le=10000)
    omnivamp: Optional[float] = Field(default=None, ge=0, le=10000)


# =====================================================================
# 5. CATEGORIES — loaded from the database, cached per server instance
# =====================================================================

@lru_cache(maxsize=1)
def category_map() -> dict:
    """{'basic': 'Basic items', ...} read from the categories table."""
    try:
        rows = read_client().table("categories").select("id, name").order("id").execute().data
    except Exception as exc:
        raise db_error(exc, "loading categories")
    return {row["id"]: row["name"] for row in rows}


def category_id_for(display_name: str) -> str:
    """Turn 'Basic items' into 'basic'. 400 with the allowed values if unknown."""
    for cid, name in category_map().items():
        if name.lower() == display_name.strip().lower():
            return cid
    allowed = ", ".join(sorted(category_map().values()))
    raise HTTPException(status_code=400, detail=f"Unknown category. Allowed values: {allowed}.")


# =====================================================================
# 6. ROW -> API SHAPE
#    The database uses snake_case; the three websites expect camelCase and
#    the category display name, so every row is translated here.
# =====================================================================

def to_api(row: dict) -> dict:
    out = {
        "id": row["id"],
        "name": row["name"],
        "price": row["price"],
        "category": category_map().get(row["category_id"], row["category_id"]),
        "image": row["image"],
        "description": row.get("description") or "",
        "sellPrice": row["sell_price"],
    }
    for camel, snake in STAT_FIELDS.items():
        out[camel] = row.get(snake, 0)
    return out


def to_row(data: dict) -> dict:
    """The reverse: an API body becomes database columns."""
    row = {}
    if "name" in data:
        row["name"] = data["name"].strip()
    if "price" in data:
        row["price"] = data["price"]
    if "sellPrice" in data:
        row["sell_price"] = data["sellPrice"]
    if "category" in data:
        row["category_id"] = category_id_for(data["category"])
    if "image" in data:
        row["image"] = data["image"].strip()
    if "description" in data:
        row["description"] = data["description"].strip()
    for camel, snake in STAT_FIELDS.items():
        if camel in data:
            row[snake] = data[camel]
    return row


def fetch_item_or_404(item_id: int) -> dict:
    try:
        rows = read_client().table("items").select("*").eq("id", item_id).limit(1).execute().data
    except Exception as exc:
        raise db_error(exc, f"reading item {item_id}")
    if not rows:
        raise HTTPException(status_code=404, detail="Item not found.")
    return rows[0]


# =====================================================================
# 7. HEALTH CHECK (public)
# =====================================================================

@app.get("/health")
def health_check():
    """Also reports whether the database can be reached."""
    database = "connected"
    status = "ok"
    try:
        read_client().table("items").select("id").limit(1).execute()
    except Exception as exc:
        logger.error("Health check could not reach the database: %s", exc)
        database = "unreachable"
        status = "degraded"

    return {
        "status": status,
        "service": "League of Legends Item API",
        "version": API_VERSION,
        "database": database,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


# =====================================================================
# 8. READ ENDPOINTS
# =====================================================================

@app.get("/api/v1/categories", dependencies=[Depends(verify_api_key)])
def get_categories():
    data = category_map()
    return {"count": len(data), "categories": sorted(data.values())}


@app.get("/api/v1/items", dependencies=[Depends(verify_api_key)])
def get_items(category: Optional[str] = Query(default=None, max_length=50)):
    """All items, oldest id first. Optional ?category=Basic items filter."""
    try:
        query = read_client().table("items").select("*").order("id")
        if category:
            query = query.eq("category_id", category_id_for(category))
        rows = query.execute().data
    except HTTPException:
        raise
    except Exception as exc:
        raise db_error(exc, "listing items")

    return {"count": len(rows), "items": [to_api(r) for r in rows]}


@app.get("/api/v1/items/search", dependencies=[Depends(verify_api_key)])
def search_items(q: str = Query(..., min_length=1, max_length=100)):
    """
    Searches name, price, category, description and every stat.
    The work is done by the search_items() function inside PostgreSQL, and the
    search text is passed as a parameter, so it cannot change the query.
    """
    q = q.lower()
    try:
        rows = read_client().rpc("search_items", {"q": q}).execute().data or []
    except Exception as exc:
        raise db_error(exc, "searching items")

    return {"query": q, "count": len(rows), "results": [to_api(r) for r in rows]}


@app.get("/api/v1/items/{item_id}", dependencies=[Depends(verify_api_key)])
def get_item(item_id: int):
    return to_api(fetch_item_or_404(item_id))


# =====================================================================
# 9. WRITE ENDPOINTS — require the admin key
# =====================================================================

@app.post("/api/v1/items", status_code=201, dependencies=[Depends(verify_admin_key)])
def create_item(item: ItemCreate):
    """Creates an item. The database assigns the new id."""
    row = to_row(item.model_dump())
    try:
        created = write_client().table("items").insert(row).execute().data
    except Exception as exc:
        raise db_error(exc, "creating an item")

    if not created:
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
    return to_api(created[0])


@app.put("/api/v1/items/{item_id}", dependencies=[Depends(verify_admin_key)])
def replace_item(item_id: int, item: ItemCreate):
    """Replaces every field of an existing item."""
    fetch_item_or_404(item_id)                    # 404 before attempting the write
    row = to_row(item.model_dump())
    try:
        updated = write_client().table("items").update(row).eq("id", item_id).execute().data
    except Exception as exc:
        raise db_error(exc, f"replacing item {item_id}")

    if not updated:
        raise HTTPException(status_code=404, detail="Item not found.")
    return to_api(updated[0])


@app.patch("/api/v1/items/{item_id}", dependencies=[Depends(verify_admin_key)])
def update_item(item_id: int, changes: ItemPatch):
    """Changes only the fields that were sent."""
    existing = fetch_item_or_404(item_id)

    sent = changes.model_dump(exclude_none=True)
    if not sent:
        raise HTTPException(status_code=400, detail="No fields to update.")

    # sellPrice must still not exceed price once the change is applied
    new_price = sent.get("price", existing["price"])
    new_sell = sent.get("sellPrice", existing["sell_price"])
    if new_sell > new_price:
        raise HTTPException(status_code=400, detail="Invalid input. sellPrice cannot be greater than price.")

    row = to_row(sent)
    try:
        updated = write_client().table("items").update(row).eq("id", item_id).execute().data
    except Exception as exc:
        raise db_error(exc, f"updating item {item_id}")

    if not updated:
        raise HTTPException(status_code=404, detail="Item not found.")
    return to_api(updated[0])


@app.delete("/api/v1/items/{item_id}", dependencies=[Depends(verify_admin_key)])
def delete_item(item_id: int):
    """Deletes an item and returns what was removed."""
    fetch_item_or_404(item_id)
    try:
        deleted = write_client().table("items").delete().eq("id", item_id).execute().data
    except Exception as exc:
        raise db_error(exc, f"deleting item {item_id}")

    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found.")
    return {"message": "Item deleted.", "item": to_api(deleted[0])}