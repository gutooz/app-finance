from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def create_or_join() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("💑 Criar casal", callback_data="onboard:create"),
            InlineKeyboardButton("🔗 Entrar com código", callback_data="onboard:join"),
        ]
    ])
