import calendar
from datetime import datetime, date
from bson import ObjectId
from backend.mongo_client import db


def _ser_expense(doc: dict) -> dict:
    paid_by = doc.get("paid_by") or {}
    d = doc.get("date")
    date_str = d.strftime("%Y-%m-%d") if isinstance(d, datetime) else str(d)
    return {
        "id": str(doc["_id"]),
        "amount": doc["amount"],
        "category": doc["category"],
        "description": doc.get("description", ""),
        "split_type": doc["split_type"],
        "date": date_str,
        "source": doc.get("source", "manual"),
        "paid_by": {
            "id": paid_by.get("_id") or doc.get("paid_by_id"),
            "name": paid_by.get("name"),
        },
    }


def add_expense(
    couple_id: str,
    paid_by_id: str,
    amount: float,
    category: str,
    description: str = "",
    split_type: str = "couple",
    expense_date: date | None = None,
    source: str = "manual",
) -> dict:
    d = expense_date or date.today()
    doc = {
        "couple_id": ObjectId(couple_id),
        "paid_by_id": paid_by_id,
        "amount": float(amount),
        "category": category,
        "description": description,
        "split_type": split_type,
        "date": datetime(d.year, d.month, d.day),
        "source": source,
        "created_at": datetime.utcnow(),
    }
    result = db.expenses.insert_one(doc)
    doc["_id"] = result.inserted_id
    doc["paid_by"] = {"_id": paid_by_id, "name": None}
    return _ser_expense(doc)


def get_monthly_expenses(couple_id: str, month: int, year: int) -> list[dict]:
    last_day = calendar.monthrange(year, month)[1]
    start = datetime(year, month, 1)
    end = datetime(year, month, last_day, 23, 59, 59)

    pipeline = [
        {"$match": {
            "couple_id": ObjectId(couple_id),
            "date": {"$gte": start, "$lte": end},
        }},
        {"$lookup": {
            "from": "profiles",
            "localField": "paid_by_id",
            "foreignField": "_id",
            "as": "paid_by",
        }},
        {"$unwind": {"path": "$paid_by", "preserveNullAndEmptyArrays": True}},
        {"$sort": {"date": -1, "created_at": -1}},
    ]
    return [_ser_expense(d) for d in db.expenses.aggregate(pipeline)]


def delete_expense(expense_id: str, couple_id: str) -> bool:
    result = db.expenses.delete_one({
        "_id": ObjectId(expense_id),
        "couple_id": ObjectId(couple_id),
    })
    return result.deleted_count > 0
