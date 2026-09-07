import calendar
from datetime import datetime, date
from bson import ObjectId
from backend.mongo_client import db
from backend.services.credit_card_service import (
    CREDIT_CARD_CATEGORY_VALUE,
    CREDIT_CARD_SYSTEM_KEY,
    CreditCardDueDayRequired,
    calculate_credit_card_due_date,
    is_credit_card_category,
    is_credit_card_payment_method,
    normalize_payment_method,
)


def _format_date(value) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, date):
        return value.isoformat()
    return str(value) if value else ""


def _ser_expense(doc: dict) -> dict:
    paid_by = doc.get("paid_by") or {}
    return {
        "id": str(doc["_id"]),
        "amount": doc["amount"],
        "category": doc["category"],
        "description": doc.get("description", ""),
        "split_type": doc["split_type"],
        "date": _format_date(doc.get("date")),
        "purchase_date": _format_date(doc.get("purchase_date")),
        "payment_method": doc.get("payment_method", "cash"),
        "credit_card_due_day": doc.get("credit_card_due_day"),
        "source": doc.get("source", "manual"),
        "type": doc.get("type", "expense"),
        "paid_by": {
            "id": paid_by.get("_id") or doc.get("paid_by_id"),
            "name": paid_by.get("name"),
        },
        "payer_amounts": doc.get("payer_amounts") or {},
    }


def _get_credit_card_due_day(couple_id: str, payment_method: str) -> int | None:
    if not is_credit_card_payment_method(payment_method):
        return None

    credit_card_category = db.categories.find_one({
        "couple_id": ObjectId(couple_id),
        "$or": [
            {"system_key": CREDIT_CARD_SYSTEM_KEY},
            {"value": CREDIT_CARD_CATEGORY_VALUE},
        ],
    })
    due_day = credit_card_category.get("due_day") if credit_card_category else None
    if due_day is None:
        raise CreditCardDueDayRequired("Configure o dia de vencimento do cartão de crédito antes de lançar no crédito.")
    return int(due_day)


def add_expense(
    couple_id: str,
    paid_by_id: str,
    amount: float,
    category: str,
    description: str = "",
    split_type: str = "couple",
    expense_date: date | None = None,
    source: str = "manual",
    payer_amounts: dict[str, float] | None = None,
    type: str = "expense",
    payment_method: str = "cash",
) -> dict:
    purchase_date = expense_date or date.today()
    normalized_payment_method = normalize_payment_method(payment_method)
    if type != "income" and is_credit_card_category(category):
        normalized_payment_method = "credit_card"
    due_day = _get_credit_card_due_day(couple_id, normalized_payment_method) if type != "income" else None
    effective_date = calculate_credit_card_due_date(purchase_date, due_day) if due_day else purchase_date

    doc = {
        "couple_id": ObjectId(couple_id),
        "paid_by_id": paid_by_id,
        "amount": float(amount),
        "category": category,
        "description": description,
        "split_type": split_type,
        "date": datetime(effective_date.year, effective_date.month, effective_date.day),
        "payment_method": normalized_payment_method,
        "source": source,
        "type": type,
        "created_at": datetime.utcnow(),
    }
    if due_day:
        doc["purchase_date"] = datetime(purchase_date.year, purchase_date.month, purchase_date.day)
        doc["credit_card_due_day"] = due_day
    if payer_amounts:
        doc["payer_amounts"] = {k: float(v) for k, v in payer_amounts.items()}
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
