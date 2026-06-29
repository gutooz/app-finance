import math
from datetime import datetime, date
from bson import ObjectId
from backend.mongo_client import db


def _ser_goal(doc: dict) -> dict:
    d = doc.get("deadline")
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "emoji": doc.get("emoji", ""),
        "target_amount": doc["target_amount"],
        "current_amount": doc["current_amount"],
        "deadline": d.strftime("%Y-%m-%d") if isinstance(d, datetime) else None,
        "is_completed": doc.get("is_completed", False),
    }


def create_goal(
    couple_id: str,
    name: str,
    target_amount: float,
    emoji: str = "",
    deadline: date | None = None,
) -> dict:
    doc = {
        "couple_id": ObjectId(couple_id),
        "name": name,
        "emoji": emoji,
        "target_amount": float(target_amount),
        "current_amount": 0.0,
        "deadline": datetime(deadline.year, deadline.month, deadline.day) if deadline else None,
        "is_completed": False,
        "contributions": [],
        "created_at": datetime.utcnow(),
    }
    result = db.goals.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _ser_goal(doc)


def get_couple_goals(couple_id: str, include_completed: bool = False) -> list[dict]:
    query: dict = {"couple_id": ObjectId(couple_id)}
    if not include_completed:
        query["is_completed"] = False
    docs = list(db.goals.find(query, sort=[("created_at", 1)]))
    return [_ser_goal(d) for d in docs]


def add_contribution(goal_id: str, user_id: str, amount: float, note: str = "") -> dict | None:
    now = datetime.utcnow()
    contribution = {
        "user_id": user_id,
        "amount": float(amount),
        "note": note,
        "date": now,
        "created_at": now,
    }
    # Atomic pipeline update: increments current_amount and checks completion
    doc = db.goals.find_one_and_update(
        {"_id": ObjectId(goal_id)},
        [
            {"$set": {
                "current_amount": {"$add": ["$current_amount", float(amount)]},
                "is_completed": {"$gte": [{"$add": ["$current_amount", float(amount)]}, "$target_amount"]},
                "contributions": {"$concatArrays": ["$contributions", [contribution]]},
            }},
        ],
        return_document=True,
    )
    if not doc:
        return None
    return _ser_goal(doc)


def delete_goal(goal_id: str, couple_id: str) -> bool:
    result = db.goals.delete_one({
        "_id": ObjectId(goal_id),
        "couple_id": ObjectId(couple_id),
    })
    return result.deleted_count > 0


def months_to_goal(current: float, target: float, monthly: float) -> int | None:
    remaining = target - current
    if monthly <= 0 or remaining <= 0:
        return None
    return math.ceil(remaining / monthly)
