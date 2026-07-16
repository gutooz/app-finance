import re
import unicodedata
from datetime import datetime
from bson import ObjectId
from backend.mongo_client import db

DEFAULT_CATEGORIES = [
    {"name": "Mercado",     "value": "mercado",     "emoji": "🛒", "type": "expense"},
    {"name": "Aluguel",     "value": "aluguel",     "emoji": "🏠", "type": "expense"},
    {"name": "Gasolina",    "value": "gasolina",    "emoji": "⛽", "type": "expense"},
    {"name": "Restaurante", "value": "restaurante", "emoji": "🍽️", "type": "expense"},
    {"name": "Transporte",  "value": "transporte",  "emoji": "🚗", "type": "expense"},
    {"name": "Internet",    "value": "internet",    "emoji": "📶", "type": "expense"},
    {"name": "Saúde",       "value": "saude",       "emoji": "💊", "type": "expense"},
    {"name": "Pet",         "value": "pet",         "emoji": "🐾", "type": "expense"},
    {"name": "Streaming",   "value": "streaming",   "emoji": "🎬", "type": "expense"},
    {"name": "Lazer",       "value": "lazer",       "emoji": "🎉", "type": "expense"},
    {"name": "Casa",        "value": "casa",        "emoji": "🛋️", "type": "expense"},
    {"name": "Pessoal",     "value": "pessoal",     "emoji": "👤", "type": "expense"},
    {"name": "Outros",      "value": "outros",      "emoji": "📦", "type": "expense"},
]

DEFAULT_INCOME_CATEGORIES = [
    {"name": "Salário",       "value": "salario",       "emoji": "💼", "type": "income"},
    {"name": "Freelance",     "value": "freelance",     "emoji": "💻", "type": "income"},
    {"name": "Investimentos", "value": "investimentos", "emoji": "📈", "type": "income"},
    {"name": "Presente",      "value": "presente",      "emoji": "🎁", "type": "income"},
    {"name": "Reembolso",     "value": "reembolso",     "emoji": "🔄", "type": "income"},
    {"name": "Outros",        "value": "outros-receita", "emoji": "📥", "type": "income"},
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
        "type": doc.get("type", "expense"),
    }


def _seed(couple_id: str, categories: list[dict]) -> list[dict]:
    now = datetime.utcnow()
    docs = [
        {**c, "couple_id": ObjectId(couple_id), "created_at": now}
        for c in categories
    ]
    if docs:
        result = db.categories.insert_many(docs)
        for doc, _id in zip(docs, result.inserted_ids):
            doc["_id"] = _id
    return docs


def get_couple_categories(couple_id: str) -> list[dict]:
    docs = list(db.categories.find({"couple_id": ObjectId(couple_id)}, sort=[("created_at", 1)]))
    if not docs:
        docs = _seed(couple_id, DEFAULT_CATEGORIES + DEFAULT_INCOME_CATEGORIES)
    elif not any(d.get("type", "expense") == "income" for d in docs):
        docs = docs + _seed(couple_id, DEFAULT_INCOME_CATEGORIES)
    return [_ser(d) for d in docs]


def create_category(couple_id: str, name: str, emoji: str, type: str = "expense") -> dict:
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
        "type": type,
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
