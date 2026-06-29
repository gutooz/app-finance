import secrets
import uuid
from datetime import datetime
from bson import ObjectId
from backend.mongo_client import db


def _ser(doc: dict | None) -> dict | None:
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["id"] = str(v) if isinstance(v, ObjectId) else v
        elif k == "password_hash":
            continue  # never expose password hashes
        elif isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = _ser(v)
        elif isinstance(v, list):
            out[k] = [_ser(i) if isinstance(i, dict) else i for i in v]
        else:
            out[k] = v
    return out


# ── profiles ────────────────────────────────────────────────

def get_profile(user_id: str) -> dict | None:
    doc = db.profiles.find_one({"_id": user_id})
    return _ser(doc)


def get_profile_by_telegram(telegram_id: int) -> dict | None:
    doc = db.profiles.find_one({"telegram_id": telegram_id})
    return _ser(doc)


def create_telegram_user(telegram_id: int, name: str, income: float) -> dict:
    """Create a MongoDB-only user for a Telegram-only registration."""
    user_id = str(uuid.uuid4())
    fake_email = f"tg_{telegram_id}@fincouple-bot.internal"
    db.profiles.insert_one({
        "_id": user_id,
        "email": fake_email,
        "password_hash": "",
        "name": name,
        "monthly_income": float(income),
        "telegram_id": telegram_id,
        "status": "telegram_only",
        "couple_id": None,
        "created_at": datetime.utcnow(),
    })
    return get_profile(user_id) or {}


def upsert_profile(
    user_id: str,
    name: str,
    income: float,
    telegram_id: int | None = None,
    gender: str = "female",
) -> dict:
    normalized_gender = gender if gender in ("male", "female") else "female"
    data: dict = {
        "name": name,
        "monthly_income": float(income),
        "gender": normalized_gender,
        "status": "active",
    }
    if telegram_id:
        data["telegram_id"] = telegram_id
    db.profiles.update_one(
        {"_id": user_id},
        {"$set": data, "$setOnInsert": {"created_at": datetime.utcnow(), "couple_id": None}},
        upsert=True,
    )
    return get_profile(user_id) or {}


# ── couples ─────────────────────────────────────────────────

def get_couple(couple_id: str) -> dict | None:
    try:
        docs = list(db.couples.aggregate([
            {"$match": {"_id": ObjectId(couple_id)}},
            {"$lookup": {"from": "profiles", "localField": "user1_id", "foreignField": "_id", "as": "user1"}},
            {"$unwind": {"path": "$user1", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {"from": "profiles", "localField": "user2_id", "foreignField": "_id", "as": "user2"}},
            {"$unwind": {"path": "$user2", "preserveNullAndEmptyArrays": True}},
            {"$project": {
                "split_mode": 1, "invite_token": 1, "is_complete": 1,
                "user1_id": 1, "user2_id": 1,
                "user1._id": 1, "user1.name": 1, "user1.monthly_income": 1, "user1.gender": 1,
                "user2._id": 1, "user2.name": 1, "user2.monthly_income": 1, "user2.gender": 1,
            }},
        ]))
        if not docs:
            return None
        doc = docs[0]
        doc["id"] = str(doc.pop("_id"))

        u1 = doc.get("user1")
        if u1:
            doc["user1"] = {
                "id": u1.get("_id"),
                "name": u1.get("name"),
                "monthly_income": u1.get("monthly_income"),
                "gender": u1.get("gender"),
            }
        u2 = doc.get("user2") if isinstance(doc.get("user2"), dict) and doc.get("user2") else None
        doc["user2"] = {
            "id": u2["_id"],
            "name": u2["name"],
            "monthly_income": u2["monthly_income"],
            "gender": u2.get("gender"),
        } if u2 and u2.get("_id") else None
        return doc
    except Exception:
        return None


def get_couple_by_token(token: str) -> dict | None:
    try:
        doc = db.couples.find_one({"invite_token": token})
        if not doc:
            return None
        doc["id"] = str(doc.pop("_id"))
        return doc
    except Exception:
        return None


def create_couple(user1_id: str, split_mode: str = "50_50") -> dict:
    token = secrets.token_urlsafe(8)
    result = db.couples.insert_one({
        "user1_id": user1_id,
        "user2_id": None,
        "split_mode": split_mode,
        "invite_token": token,
        "is_complete": False,
        "created_at": datetime.utcnow(),
    })
    couple_oid = result.inserted_id
    db.profiles.update_one({"_id": user1_id}, {"$set": {"couple_id": couple_oid}})
    return get_couple(str(couple_oid)) or {}


def join_couple(couple_id: str, user2_id: str, split_mode: str) -> dict:
    oid = ObjectId(couple_id)
    couple_doc = db.couples.find_one({"_id": oid}, {"user1_id": 1})
    user1_id = couple_doc["user1_id"] if couple_doc else None
    db.couples.update_one(
        {"_id": oid},
        {"$set": {"user2_id": user2_id, "split_mode": split_mode, "is_complete": True}},
    )
    ids = [uid for uid in [user1_id, user2_id] if uid]
    if ids:
        db.profiles.update_many({"_id": {"$in": ids}}, {"$set": {"couple_id": oid}})
    return get_couple(couple_id) or {}


def get_partner_profile(user_id: str, couple: dict) -> dict | None:
    partner_id = couple.get("user2_id") if couple.get("user1_id") == user_id else couple.get("user1_id")
    if not partner_id:
        return None
    return get_profile(partner_id)


def calculate_split(amount: float, split_mode: str, income1: float, income2: float) -> tuple[float, float]:
    if split_mode == "proportional":
        total = (income1 or 0) + (income2 or 0)
        if total > 0:
            return (income1 / total) * amount, (income2 / total) * amount
    return amount / 2, amount / 2
