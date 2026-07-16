from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from backend.bot.states import SPLIT_MODES


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
