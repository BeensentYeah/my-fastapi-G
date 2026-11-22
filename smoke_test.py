"""
Smoke test for the LoL Item API.

Runs every endpoint against the live deployment and prints a PASS/FAIL table you
can screenshot for the testing section of the report. It cleans up after itself:
the test item it creates is deleted at the end.

Uses only the Python standard library, so there is nothing to install.

Usage:
    python smoke_test.py https://my-fastapi-g-api.vercel.app YOUR_API_KEY YOUR_ADMIN_KEY
"""

import json
import sys
import urllib.error
import urllib.request

if len(sys.argv) != 4:
    print(__doc__)
    sys.exit(2)

BASE, API_KEY, ADMIN_KEY = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3]

results = []


def call(method, path, body=None, api_key=API_KEY, admin_key=None):
    """Returns (status_code, parsed_body)."""
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    if api_key:
        req.add_header("x-api-key", api_key)
    if admin_key:
        req.add_header("x-admin-key", admin_key)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as err:
        raw = err.read().decode()
        try:
            return err.code, json.loads(raw)
        except json.JSONDecodeError:
            return err.code, raw
    except Exception as exc:                      # network problem, not an API response
        return 0, str(exc)


def check(label, expected_status, got_status, note=""):
    ok = got_status == expected_status
    results.append((ok, label, expected_status, got_status, note))
    print(f"{'PASS' if ok else 'FAIL'}  {label:<48} expected {expected_status}, got {got_status}  {note}")
    return ok


TEST_ITEM = {
    "name": "Smoke Test Blade",
    "price": 1000,
    "sellPrice": 700,
    "category": "Basic items",
    "image": "smoke.png",
    "description": "Temporary item created by smoke_test.py.",
    "attackDamage": 40,
}

print(f"Testing {BASE}\n")

# ---- reading -------------------------------------------------------------
status, body = call("GET", "/health", api_key=None)
check("health check is public", 200, status, f"database={body.get('database') if isinstance(body, dict) else body}")

status, body = call("GET", "/api/v1/items", api_key=None)
check("list without API key is rejected", 401, status)

status, body = call("GET", "/api/v1/items", api_key="wrong-key")
check("list with a wrong API key is rejected", 401, status)

status, body = call("GET", "/api/v1/items")
count = body.get("count") if isinstance(body, dict) else "?"
check("list all items", 200, status, f"count={count}")

status, body = call("GET", "/api/v1/items/1")
check("read one item", 200, status, f"name={body.get('name') if isinstance(body, dict) else body}")

status, _ = call("GET", "/api/v1/items/999999")
check("read a missing item", 404, status)

status, _ = call("GET", "/api/v1/items/not-a-number")
check("read with a malformed id", 400, status)

status, body = call("GET", "/api/v1/items/search?q=sword")
check("search for 'sword'", 200, status, f"count={body.get('count') if isinstance(body, dict) else body}")

status, body = call("GET", "/api/v1/items/search?q=zzzzzzzz")
check("search with no matches", 200, status, f"count={body.get('count') if isinstance(body, dict) else body}")

status, _ = call("GET", "/api/v1/items/search")
check("search with no query", 400, status)

status, body = call("GET", "/api/v1/categories")
check("list categories", 200, status, f"count={body.get('count') if isinstance(body, dict) else body}")

status, body = call("GET", "/api/v1/items?category=Boots")
check("filter by category", 200, status, f"count={body.get('count') if isinstance(body, dict) else body}")

# ---- writing: authentication --------------------------------------------
status, _ = call("POST", "/api/v1/items", TEST_ITEM)
check("create without admin key is rejected", 403, status)

status, _ = call("POST", "/api/v1/items", TEST_ITEM, admin_key="wrong-admin-key")
check("create with a wrong admin key is rejected", 403, status)

status, _ = call("POST", "/api/v1/items", TEST_ITEM, api_key=None, admin_key=ADMIN_KEY)
check("create without API key is rejected", 401, status)

# ---- writing: validation -------------------------------------------------
status, _ = call("POST", "/api/v1/items", {**TEST_ITEM, "sellPrice": 5000}, admin_key=ADMIN_KEY)
check("sellPrice above price is rejected", 400, status)

status, _ = call("POST", "/api/v1/items", {**TEST_ITEM, "price": -10}, admin_key=ADMIN_KEY)
check("negative price is rejected", 400, status)

status, _ = call("POST", "/api/v1/items", {**TEST_ITEM, "category": "Mythic items"}, admin_key=ADMIN_KEY)
check("unknown category is rejected", 400, status)

status, _ = call("POST", "/api/v1/items", {"name": "Incomplete"}, admin_key=ADMIN_KEY)
check("missing required fields rejected", 400, status)

status, _ = call("POST", "/api/v1/items", {**TEST_ITEM, "name": "Doran's Blade"}, admin_key=ADMIN_KEY)
check("duplicate name is rejected", 409, status)

# ---- writing: the happy path --------------------------------------------
new_id = None
status, body = call("POST", "/api/v1/items", TEST_ITEM, admin_key=ADMIN_KEY)
if check("create an item", 201, status, f"id={body.get('id') if isinstance(body, dict) else body}"):
    new_id = body["id"]

if new_id:
    status, body = call("GET", f"/api/v1/items/{new_id}")
    check("the new item can be read back", 200, status, f"price={body.get('price') if isinstance(body, dict) else ''}")

    status, body = call("PATCH", f"/api/v1/items/{new_id}", {"price": 1200}, admin_key=ADMIN_KEY)
    ok = check("partial update (PATCH)", 200, status)
    if ok and isinstance(body, dict) and body.get("price") != 1200:
        print(f"      WARNING: price is {body.get('price')}, expected 1200")

    status, _ = call("PATCH", f"/api/v1/items/{new_id}", {"price": 10}, admin_key=ADMIN_KEY)
    check("PATCH that breaks sellPrice <= price", 400, status)

    status, body = call("PUT", f"/api/v1/items/{new_id}",
                        {**TEST_ITEM, "description": "Replaced by PUT."}, admin_key=ADMIN_KEY)
    check("full replace (PUT)", 200, status)

    status, _ = call("DELETE", f"/api/v1/items/{new_id}", admin_key=ADMIN_KEY)
    check("delete the item", 200, status)

    status, _ = call("GET", f"/api/v1/items/{new_id}")
    check("the deleted item is gone", 404, status)

status, _ = call("DELETE", "/api/v1/items/999999", admin_key=ADMIN_KEY)
check("delete a missing item", 404, status)

# ---- summary -------------------------------------------------------------
passed = sum(1 for r in results if r[0])
print(f"\n{passed} of {len(results)} checks passed.")
if passed != len(results):
    print("Failed:", ", ".join(r[1] for r in results if not r[0]))
sys.exit(0 if passed == len(results) else 1)