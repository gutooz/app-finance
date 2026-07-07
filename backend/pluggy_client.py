import os
import time
import httpx

PLUGGY_BASE_URL = os.getenv("PLUGGY_BASE_URL", "https://api.pluggy.ai")
PLUGGY_CLIENT_ID = os.getenv("PLUGGY_CLIENT_ID", "")
PLUGGY_CLIENT_SECRET = os.getenv("PLUGGY_CLIENT_SECRET", "")

_api_key: str | None = None
_api_key_expires_at: float = 0.0


def _get_api_key() -> str:
    """Pluggy API keys are valid for ~2h. Cache and renew as needed."""
    global _api_key, _api_key_expires_at
    if _api_key and time.time() < _api_key_expires_at:
        return _api_key

    if not PLUGGY_CLIENT_ID or not PLUGGY_CLIENT_SECRET:
        raise RuntimeError("PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET sao obrigatorios no .env")

    resp = httpx.post(
        f"{PLUGGY_BASE_URL}/auth",
        json={"clientId": PLUGGY_CLIENT_ID, "clientSecret": PLUGGY_CLIENT_SECRET},
        timeout=15,
    )
    resp.raise_for_status()
    _api_key = resp.json()["apiKey"]
    _api_key_expires_at = time.time() + 60 * 100  # renew a bit before the 2h expiry
    return _api_key


def _headers() -> dict:
    return {"X-API-KEY": _get_api_key(), "Content-Type": "application/json"}


def create_connect_token(client_user_id: str | None = None, item_id: str | None = None) -> str:
    """Create a short-lived token the frontend uses to open Pluggy Connect."""
    payload: dict = {}
    if client_user_id:
        payload["clientUserId"] = client_user_id
    if item_id:
        payload["itemId"] = item_id
    resp = httpx.post(f"{PLUGGY_BASE_URL}/connect_token", json=payload, headers=_headers(), timeout=15)
    resp.raise_for_status()
    return resp.json()["accessToken"]


def get_item(item_id: str) -> dict:
    resp = httpx.get(f"{PLUGGY_BASE_URL}/items/{item_id}", headers=_headers(), timeout=15)
    resp.raise_for_status()
    return resp.json()


def delete_item(item_id: str) -> None:
    httpx.delete(f"{PLUGGY_BASE_URL}/items/{item_id}", headers=_headers(), timeout=15)


def list_accounts(item_id: str) -> list[dict]:
    resp = httpx.get(f"{PLUGGY_BASE_URL}/accounts", params={"itemId": item_id}, headers=_headers(), timeout=15)
    resp.raise_for_status()
    return resp.json().get("results", [])


def list_transactions(account_id: str, from_date: str | None = None) -> list[dict]:
    """Fetch all transactions for an account, following pagination."""
    transactions: list[dict] = []
    page = 1
    page_size = 500
    params = {"accountId": account_id, "page": page, "pageSize": page_size}
    if from_date:
        params["from"] = from_date

    while True:
        params["page"] = page
        resp = httpx.get(f"{PLUGGY_BASE_URL}/transactions", params=params, headers=_headers(), timeout=30)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        transactions.extend(results)
        total_pages = data.get("totalPages", 1)
        if page >= total_pages or not results:
            break
        page += 1

    return transactions
