import re
import unicodedata
from datetime import datetime
from bson import ObjectId
from backend.mongo_client import db

DEFAULT_CATEGORIES = [
    {"name": "Mercado",     "value": "mercado",     "emoji": "🛒"},
    {"name": "Aluguel",     "value": "aluguel",     "emoji": "🏠"},
    {"name": "Gasolina",    "value": "gasolina",    "emoji": "⛽"},
    {"name": "Restaurante", "value": "restaurante", "emoji": "🍽️"},
    {"name": "Transporte",  "value": "transporte",  "emoji": "🚗"},
    {"name": "Internet",    "value": "internet",    "emoji": "📶"},
    {"name": "Saúde",       "value": "saude",       "emoji": "💊"},
    {"name": "Pet",         "value": "pet",         "emoji": "🐾"},
    {"name": "Streaming",   "value": "streaming",   "emoji": "🎬"},
    {"name": "Lazer",       "value": "lazer",       "emoji": "🎉"},
    {"name": "Casa",        "value": "casa",        "emoji": "🛋️"},
    {"name": "Pessoal",     "value": "pessoal",     "emoji": "👤"},
    {"name": "Outros",      "value": "outros",      "emoji": "📦"},
]


def _slugify(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return slug or "categoria"


def _ser(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "value": doc["value"],
        "emoji": doc.get("emoji", "📦"),
    }


def _seed_defaults(couple_id: str) -> list[dict]:
    now = datetime.utcnow()
    docs = [
        {**c, "couple_id": ObjectId(couple_id), "created_at": now}
        for c in DEFAULT_CATEGORIES
    ]
    if docs:
        result = db.categories.insert_many(docs)
        for doc, _id in zip(docs, result.inserted_ids):
            doc["_id"] = _id
    return docs


def get_couple_categories(couple_id: str) -> list[dict]:
    docs = list(db.categories.find({"couple_id": ObjectId(couple_id)}, sort=[("created_at", 1)]))
    if not docs:
        docs = _seed_defaults(couple_id)
    return [_ser(d) for d in docs]


def create_category(couple_id: str, name: str, emoji: str) -> dict:
    base_value = _slugify(name)
    value = base_value
    suffix = 2
    while db.categories.find_one({"couple_id": ObjectId(couple_id), "value": value}):
        value = f"{base_value}-{suffix}"
        suffix += 1

    doc = {
        "couple_id": ObjectId(couple_id),
        "name": name.strip(),
        "value": value,
        "emoji": emoji.strip() or "📦",
        "created_at": datetime.utcnow(),
    }
    result = db.categories.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _ser(doc)


def update_category(category_id: str, couple_id: str, name: str | None, emoji: str | None) -> dict | None:
    updates: dict = {}
    if name is not None and name.strip():
        updates["name"] = name.strip()
    if emoji is not None and emoji.strip():
        updates["emoji"] = emoji.strip()
    if not updates:
        doc = db.categories.find_one({"_id": ObjectId(category_id), "couple_id": ObjectId(couple_id)})
        return _ser(doc) if doc else None

    doc = db.categories.find_one_and_update(
        {"_id": ObjectId(category_id), "couple_id": ObjectId(couple_id)},
        {"$set": updates},
        return_document=True,
    )
    return _ser(doc) if doc else None


def delete_category(category_id: str, couple_id: str) -> bool:
    result = db.categories.delete_one({"_id": ObjectId(category_id), "couple_id": ObjectId(couple_id)})
    return result.deleted_count > 0
