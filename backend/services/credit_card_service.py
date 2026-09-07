import calendar
import re
import unicodedata
from datetime import date

CREDIT_CARD_CATEGORY_VALUE = "cartao-de-credito"
CREDIT_CARD_SYSTEM_KEY = "credit_card"
DEFAULT_PAYMENT_METHOD = "cash"

_CREDIT_CARD_ALIASES = {
    CREDIT_CARD_CATEGORY_VALUE,
    "cartao",
    "cartao-credito",
    "cartao-de-credito",
    "credito",
}

_PAYMENT_METHOD_ALIASES = {
    "pix": "pix",
    "dinheiro": "cash",
    "cash": "cash",
    "especie": "cash",
    "debito": "debit",
    "debit": "debit",
    "credito": "credit_card",
    "credit": "credit_card",
    "credit-card": "credit_card",
    "cartao": "credit_card",
    "cartao-de-credito": "credit_card",
    "cartao-credito": "credit_card",
}


class CreditCardDueDayRequired(ValueError):
    pass


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def is_credit_card_category(value: str | None) -> bool:
    return _normalize(value or "") in _CREDIT_CARD_ALIASES


def normalize_payment_method(value: str | None) -> str:
    normalized = _normalize(value or "")
    return _PAYMENT_METHOD_ALIASES.get(normalized, DEFAULT_PAYMENT_METHOD)


def is_credit_card_payment_method(value: str | None) -> bool:
    return normalize_payment_method(value) == "credit_card"


def calculate_credit_card_due_date(purchase_date: date, due_day: int) -> date:
    if due_day < 1 or due_day > 31:
        raise ValueError("Dia de vencimento do cartao invalido")

    due_year = purchase_date.year
    due_month = purchase_date.month
    if purchase_date.day > due_day:
        due_month += 1
        if due_month > 12:
            due_month = 1
            due_year += 1

    last_day = calendar.monthrange(due_year, due_month)[1]
    return date(due_year, due_month, min(due_day, last_day))
