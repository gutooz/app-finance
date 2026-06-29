from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from backend.bot.states import CATEGORIES, SPLIT_MODES, SPLIT_TYPES


def main_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("💸 Gasto", callback_data="menu:expense"),
            InlineKeyboardButton("📋 Contas", callback_data="menu:bills"),
        ],
        [
            InlineKeyboardButton("🎯 Metas", callback_data="menu:goals"),
            InlineKeyboardButton("📊 Resumo", callback_data="menu:summary"),
        ],
    ])


def create_or_join() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("💑 Criar casal", callback_data="onboard:create"),
            InlineKeyboardButton("🔗 Entrar com código", callback_data="onboard:join"),
        ]
    ])


def split_mode() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(label, callback_data=f"onboard:split:{key}")]
        for key, label in SPLIT_MODES.items()
    ])


def category() -> InlineKeyboardMarkup:
    rows, row = [], []
    for key, label in CATEGORIES:
        row.append(InlineKeyboardButton(label, callback_data=f"exp:cat:{key}"))
        if len(row) == 3:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    return InlineKeyboardMarkup(rows)


def split_type() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(label, callback_data=f"exp:split:{key}")]
        for key, label in SPLIT_TYPES
    ])


def paid_by(name1: str, name2: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton(f"Eu ({name1})", callback_data="exp:paid:me"),
        InlineKeyboardButton(name2, callback_data="exp:paid:partner"),
    ]])


def confirm_expense() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Salvar", callback_data="exp:confirm"),
        InlineKeyboardButton("❌ Cancelar", callback_data="exp:cancel"),
    ]])


def goals_list(goals: list) -> InlineKeyboardMarkup:
    rows = []
    for g in goals:
        pct = min(100, int((g["current"] / g["target"]) * 100)) if g["target"] > 0 else 0
        bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
        rows.append([InlineKeyboardButton(
            f"{g['emoji']} {g['name']} [{bar}] {pct}%",
            callback_data=f"goal:contrib:{g['id']}"
        )])
    rows.append([
        InlineKeyboardButton("➕ Nova meta", callback_data="goal:new"),
        InlineKeyboardButton("🏠 Menu", callback_data="menu:main"),
    ])
    return InlineKeyboardMarkup(rows)


def back_to_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton("🏠 Menu", callback_data="menu:main")]])
