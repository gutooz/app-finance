from datetime import datetime
from bson import ObjectId
from backend.mongo_client import db


def _ser_bill(doc: dict, month: int | None = None, year: int | None = None) -> dict:
    out = {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "amount": doc["amount"],
        "due_day": doc["due_day"],
        "is_active": doc.get("is_active", True),
    }
    if month is not None and year is not None:
        payments = doc.get("payments", [])
        out["is_paid"] = any(p["month"] == month and p["year"] == year for p in payments)
    return out


def add_bill(couple_id: str, name: str, amount: float, due_day: int) -> dict:
    doc = {
        "couple_id": ObjectId(couple_id),
        "name": name,
        "amount": float(amount),
        "due_day": int(due_day),
        "is_active": True,
        "payments": [],
        "created_at": datetime.utcnow(),
    }
    result = db.fixed_bills.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _ser_bill(doc)


def get_couple_bills(couple_id: str, month: int | None = None, year: int | None = None) -> list[dict]:
    docs = list(db.fixed_bills.find(
        {"couple_id": ObjectId(couple_id), "is_active": True},
        sort=[("due_day", 1)],
    ))
    return [_ser_bill(d, month, year) for d in docs]


def get_bill_payment(bill_id: str, month: int, year: int) -> dict | None:
    doc = db.fixed_bills.find_one(
        {"_id": ObjectId(bill_id), "payments": {"$elemMatch": {"month": month, "year": year}}},
        {"payments.$": 1},
    )
    if not doc or not doc.get("payments"):
        return None
    return doc["payments"][0]


def mark_bill_paid(bill_id: str, paid_by_id: str, month: int, year: int) -> dict:
    payment = {
        "paid_by_id": paid_by_id,
        "month": month,
        "year": year,
        "paid_at": datetime.utcnow(),
    }
    db.fixed_bills.update_one(
        {
            "_id": ObjectId(bill_id),
            "payments": {"$not": {"$elemMatch": {"month": month, "year": year}}},
        },
        {"$push": {"payments": payment}},
    )
    return payment


def unmark_bill_paid(bill_id: str, month: int, year: int) -> bool:
    result = db.fixed_bills.update_one(
        {"_id": ObjectId(bill_id)},
        {"$pull": {"payments": {"month": month, "year": year}}},
    )
    return result.modified_count > 0


def deactivate_bill(bill_id: str, couple_id: str) -> bool:
    result = db.fixed_bills.update_one(
        {"_id": ObjectId(bill_id), "couple_id": ObjectId(couple_id)},
        {"$set": {"is_active": False}},
    )
    return result.matched_count > 0
