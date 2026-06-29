from datetime import date, datetime
from bson import ObjectId
from backend.mongo_client import db


def add_transaction(
    user_id: str,
    amount: float,
    transaction_type: str,
    scope: str,
    category: str,
    description: str = "",
    couple_id: str | None = None,
    paid_by_id: str | None = None,
    transaction_date: date | None = None,
    source: str = "web",
    raw_message: str | None = None,
) -> dict:
    d = transaction_date or date.today()
    doc = {
        "user_id": user_id,
        "couple_id": ObjectId(couple_id) if couple_id else None,
        "paid_by_id": paid_by_id,
        "amount": float(amount),
        "type": transaction_type,
        "scope": scope,
        "category": category,
        "description": description,
        "source": source,
        "raw_message": raw_message,
        "transaction_date": datetime(d.year, d.month, d.day),
        "created_at": datetime.utcnow(),
    }
    result = db.transactions.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    if doc.get("couple_id"):
        doc["couple_id"] = str(doc["couple_id"])
    return doc
