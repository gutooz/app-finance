import re
import unicodedata
from datetime import date, timedelta
from backend.bot.states import CATEGORY_KEYWORDS

# "gastei 50 com pizza", "gastei 100 no mercado", "gastei 30 em gasolina"
_GASTEI_RE = re.compile(
    r"gastei\s+R?\$?\s*(\d{1,6}[.,]\d{1,2}|\d{1,6})"
    r"(?:\s+(?:com|em|no|na|num|numa|de|pelo|pela|pro|pra)\s+(.+))?",
    re.IGNORECASE,
)

# "50 no mercado", "R$72 aluguel"
_AMOUNT_FIRST_RE = re.compile(
    r"R?\$?\s*(\d{1,6}[.,]\d{1,2}|\d{1,6})\s+(.*)",
    re.IGNORECASE,
)


def _normalize(text: str) -> str:
    text = text.lower().strip()
    return "".join(
        char for char in unicodedata.normalize("NFD", text)
        if unicodedata.category(char) != "Mn"
    )


def _detect_category(text: str) -> str:
    text_lower = _normalize(text)
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(_normalize(kw) in text_lower for kw in keywords):
            return cat
    return "outros"


def _detect_type(text: str) -> str:
    text_lower = _normalize(text)
    income_words = ["recebi", "receita", "salario", "freela", "pix recebido", "deposito", "bonus"]
    return "income" if any(word in text_lower for word in income_words) else "expense"


def _detect_scope(text: str, category: str) -> str:
    text_lower = _normalize(text)
    if re.search(r"\b(meu|minha|pessoal|so meu|so minha)\b", text_lower):
        return "mine"
    if re.search(r"\b(nosso|nossa|casal|compartilhado|juntos)\b", text_lower):
        return "couple"
    shared_categories = {"mercado", "aluguel", "internet", "casa", "streaming"}
    return "couple" if category in shared_categories else "mine"


def _detect_date(text: str) -> date:
    text_lower = _normalize(text)
    if "ontem" in text_lower:
        return date.today() - timedelta(days=1)
    if "amanha" in text_lower:
        return date.today() + timedelta(days=1)

    match = re.search(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", text_lower)
    if match:
        day = int(match.group(1))
        month = int(match.group(2))
        year = int(match.group(3) or date.today().year)
        if year < 100:
            year += 2000
        try:
            return date(year, month, day)
        except ValueError:
            return date.today()
    return date.today()


def parse_expense(text: str) -> dict | None:
    """
    Parse a natural-language expense message.

    Handles:
      "gastei 72 no mercado"         → amount=72, category=mercado
      "gastei 50 com pizza"          → amount=50, category=restaurante
      "gastei 100 em gasolina"       → amount=100, category=gasolina
      "mercado 72.50"                → amount=72.50, category=mercado
      "aluguel 2000"                 → amount=2000, category=aluguel
      "72 mercado"                   → amount=72, category=mercado

    Returns dict with amount, category, description — or None if no amount.
    """
    text_stripped = text.strip()
    text_lower = _normalize(text_stripped)

    # "gastei X [prep] Y" pattern
    m = _GASTEI_RE.match(text_lower)
    if m:
        amount = float(m.group(1).replace(",", "."))
        if amount <= 0:
            return None
        desc = (m.group(2) or "").strip()
        category = _detect_category(desc + " " + text_lower)
        return {
            "amount": amount,
            "category": category,
            "description": desc,
            "type": _detect_type(text_lower),
            "split_type": _detect_scope(text_lower, category),
            "date": _detect_date(text_lower),
        }

    # Any number in the text
    amount_match = re.search(r"R?\$?\s*(\d{1,6}[.,]\d{1,2}|\d{1,6})", text_lower)
    if not amount_match:
        return None

    amount = float(amount_match.group(1).replace(",", "."))
    if amount <= 0:
        return None

    category = _detect_category(text_lower)
    return {
        "amount": amount,
        "category": category,
        "description": text_stripped,
        "type": _detect_type(text_lower),
        "split_type": _detect_scope(text_lower, category),
        "date": _detect_date(text_lower),
    }
