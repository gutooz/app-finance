import re
import unicodedata
from datetime import datetime
from bson import ObjectId
from backend.mongo_client import db
from backend.services.credit_card_service import CREDIT_CARD_CATEGORY_VALUE, CREDIT_CARD_SYSTEM_KEY

DEFAULT_CATEGORIES = [
    {
        "name": "Cartão de crédito",
        "value": CREDIT_CARD_CATEGORY_VALUE,
        "emoji": "💳",
        "type": "expense",
        "cost_type": "fixed",
        "due_day": None,
        "is_system": True,
        "system_key": CREDIT_CARD_SYSTEM_KEY,
    },
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
        "cost_type": doc.get("cost_type", "variable"),
        "due_day": doc.get("due_day"),
        "is_system": bool(doc.get("is_system")),
        "system_key": doc.get("system_key"),
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


def _ensure_credit_card_category(couple_id: str, docs: list[dict]) -> list[dict]:
    existing = next(
        (
            d for d in docs
            if d.get("system_key") == CREDIT_CARD_SYSTEM_KEY or d.get("value") == CREDIT_CARD_CATEGORY_VALUE
        ),
        None,
    )

    if existing:
        updates = {}
        if existing.get("name") != "Cartão de crédito":
            updates["name"] = "Cartão de crédito"
        if existing.get("emoji") != "💳":
            updates["emoji"] = "💳"
        if existing.get("type") != "expense":
            updates["type"] = "expense"
        if existing.get("cost_type") != "fixed":
            updates["cost_type"] = "fixed"
        if not existing.get("is_system"):
            updates["is_system"] = True
        if existing.get("system_key") != CREDIT_CARD_SYSTEM_KEY:
            updates["system_key"] = CREDIT_CARD_SYSTEM_KEY

        if updates:
            db.categories.update_one({"_id": existing["_id"]}, {"$set": updates})
            existing.update(updates)
        return docs

    inserted = _seed(couple_id, [DEFAULT_CATEGORIES[0]])
    return inserted + docs


def get_couple_categories(couple_id: str) -> list[dict]:
    docs = list(db.categories.find({"couple_id": ObjectId(couple_id)}, sort=[("created_at", 1)]))
    if not docs:
        docs = _seed(couple_id, DEFAULT_CATEGORIES + DEFAULT_INCOME_CATEGORIES)
    elif not any(d.get("type", "expense") == "income" for d in docs):
        docs = docs + _seed(couple_id, DEFAULT_INCOME_CATEGORIES)
    docs = _ensure_credit_card_category(couple_id, docs)
    return [_ser(d) for d in docs]


def create_category(
    couple_id: str,
    name: str,
    emoji: str,
    type: str = "expense",
    cost_type: str = "variable",
    due_day: int | None = None,
) -> dict:
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
        "cost_type": cost_type,
        "due_day": due_day if cost_type == "fixed" else None,
        "created_at": datetime.utcnow(),
    }
    result = db.categories.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _ser(doc)


def update_category(
    category_id: str,
    couple_id: str,
    name: str | None,
    emoji: str | None,
    cost_type: str | None = None,
    due_day: int | None = None,
) -> dict | None:
    existing = db.categories.find_one({"_id": ObjectId(category_id), "couple_id": ObjectId(couple_id)})
    if not existing:
        return None

    updates: dict = {}
    is_credit_card = existing.get("system_key") == CREDIT_CARD_SYSTEM_KEY or existing.get("value") == CREDIT_CARD_CATEGORY_VALUE
    if is_credit_card:
        updates.update({
            "name": "Cartão de crédito",
            "emoji": "💳",
            "type": "expense",
            "cost_type": "fixed",
            "is_system": True,
            "system_key": CREDIT_CARD_SYSTEM_KEY,
        })
    elif name is not None and name.strip():
        updates["name"] = name.strip()
    if not is_credit_card and emoji is not None and emoji.strip():
        updates["emoji"] = emoji.strip()
    if not is_credit_card and cost_type is not None:
        updates["cost_type"] = cost_type
        if cost_type == "variable":
            updates["due_day"] = None
    if due_day is not None:
        updates["due_day"] = due_day
    if not updates:
        return _ser(existing)

    doc = db.categories.find_one_and_update(
        {"_id": ObjectId(category_id), "couple_id": ObjectId(couple_id)},
        {"$set": updates},
        return_document=True,
    )
    return _ser(doc) if doc else None


def delete_category(category_id: str, couple_id: str) -> bool:
    category = db.categories.find_one({"_id": ObjectId(category_id), "couple_id": ObjectId(couple_id)})
    if category and (category.get("is_system") or category.get("system_key") == CREDIT_CARD_SYSTEM_KEY):
        return False

    result = db.categories.delete_one({"_id": ObjectId(category_id), "couple_id": ObjectId(couple_id)})
    return result.deleted_count > 0
