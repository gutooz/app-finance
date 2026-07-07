from datetime import datetime, timedelta
from bson import ObjectId
from backend import pluggy_client
from backend.mongo_client import db
from backend.services import couple_service

INITIAL_SYNC_DAYS = 90


def _ser_item(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "item_id": doc["item_id"],
        "connector": doc.get("connector", {}),
        "status": doc.get("status", "UPDATING"),
        "last_synced_at": doc["last_synced_at"].isoformat() if doc.get("last_synced_at") else None,
        "created_at": doc["created_at"].isoformat(),
    }


def link_item(user_id: str, item_id: str) -> dict:
    """Called after the frontend Pluggy Connect widget succeeds for an item."""
    remote_item = pluggy_client.get_item(item_id)
    connector = remote_item.get("connector") or {}

    doc = {
        "user_id": user_id,
        "item_id": item_id,
        "connector": {
            "id": connector.get("id"),
            "name": connector.get("name"),
            "imageUrl": connector.get("imageUrl"),
        },
        "status": remote_item.get("status", "UPDATING"),
    }
    db.pluggy_items.update_one(
        {"user_id": user_id, "item_id": item_id},
        {"$set": doc, "$setOnInsert": {"created_at": datetime.utcnow(), "last_synced_at": None}},
        upsert=True,
    )
    saved = db.pluggy_items.find_one({"user_id": user_id, "item_id": item_id})
    return _ser_item(saved)


def list_items(user_id: str) -> list[dict]:
    return [_ser_item(d) for d in db.pluggy_items.find({"user_id": user_id}).sort("created_at", -1)]


def _get_owned_item(user_id: str, item_id: str) -> dict | None:
    return db.pluggy_items.find_one({"user_id": user_id, "item_id": item_id})


def unlink_item(user_id: str, item_id: str) -> bool:
    owned = _get_owned_item(user_id, item_id)
    if not owned:
        return False
    pluggy_client.delete_item(item_id)
    db.pluggy_items.delete_one({"_id": owned["_id"]})
    return True


def get_accounts(user_id: str, item_id: str) -> list[dict]:
    if not _get_owned_item(user_id, item_id):
        return []
    accounts = pluggy_client.list_accounts(item_id)
    return [
        {
            "id": a["id"],
            "name": a.get("name"),
            "type": a.get("type"),
            "subtype": a.get("subtype"),
            "balance": a.get("balance"),
            "currencyCode": a.get("currencyCode"),
        }
        for a in accounts
    ]


def sync_item(user_id: str, item_id: str) -> dict:
    """Pull transactions for every account of this item and import debits as expenses."""
    owned = _get_owned_item(user_id, item_id)
    if not owned:
        raise ValueError("Item nao encontrado")

    profile = couple_service.get_profile(user_id)
    couple_id = profile.get("couple_id") if profile else None
    if not couple_id:
        raise ValueError("Usuario precisa pertencer a um casal para importar transacoes")

    last_synced_at = owned.get("last_synced_at")
    from_date = (last_synced_at or (datetime.utcnow() - timedelta(days=INITIAL_SYNC_DAYS))).strftime("%Y-%m-%d")

    remote_item = pluggy_client.get_item(item_id)
    accounts = pluggy_client.list_accounts(item_id)

    imported = 0
    for account in accounts:
        transactions = pluggy_client.list_transactions(account["id"], from_date=from_date)
        for tx in transactions:
            amount = tx.get("amount", 0)
            if amount >= 0:
                continue  # only debits (money out) become expenses

            tx_date = tx.get("date", "")[:10]
            try:
                d = datetime.strptime(tx_date, "%Y-%m-%d")
            except ValueError:
                d = datetime.utcnow()

            result = db.expenses.update_one(
                {"external_id": tx["id"]},
                {
                    "$setOnInsert": {
                        "couple_id": ObjectId(couple_id) if isinstance(couple_id, str) else couple_id,
                        "paid_by_id": user_id,
                        "amount": abs(float(amount)),
                        "category": (tx.get("category") or "outros").lower(),
                        "description": tx.get("description", ""),
                        "split_type": "couple",
                        "date": d,
                        "source": "pluggy",
                        "external_id": tx["id"],
                        "created_at": datetime.utcnow(),
                    }
                },
                upsert=True,
            )
            if result.upserted_id:
                imported += 1

    db.pluggy_items.update_one(
        {"_id": owned["_id"]},
        {"$set": {"last_synced_at": datetime.utcnow(), "status": remote_item.get("status", owned.get("status"))}},
    )

    return {"imported": imported, "synced_at": datetime.utcnow().isoformat()}


def handle_webhook_event(event: dict) -> None:
    """Runs in a background task after the webhook responds — never let Pluggy retry due to slow processing."""
    event_type = event.get("event")
    item_id = event.get("itemId")
    if not item_id:
        return

    owned = db.pluggy_items.find_one({"item_id": item_id})
    if not owned:
        return  # item not linked to any user (yet) — nothing to do

    if event_type in ("item/created", "item/updated"):
        try:
            sync_item(owned["user_id"], item_id)
        except Exception:
            pass
    elif event_type == "item/error":
        error = event.get("error") or {}
        db.pluggy_items.update_one(
            {"_id": owned["_id"]},
            {"$set": {"status": error.get("code", "ERROR")}},
        )
