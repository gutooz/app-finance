from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

from backend.mongo_client import db
from backend.password import verify_password
from backend.services import couple_service
from backend.bot import keyboards
from backend.bot.handlers.user_context import clear_user_context
from backend.bot.states import LOGIN_EMAIL, LOGIN_PASSWORD


async def start_login(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    tg_id = update.effective_user.id

    # Already linked — show status and menu
    profile = couple_service.get_profile_by_telegram(tg_id)
    if profile:
        couple_info = ""
        if profile.get("couple_id"):
            couple = couple_service.get_couple(str(profile["couple_id"]))
            if couple and couple.get("is_complete"):
                partner = couple_service.get_partner_profile(profile["id"], couple)
                if partner:
                    couple_info = f"\n👫 Parceiro(a): *{partner['name']}*"
        await update.message.reply_text(
            f"✅ Você já está conectado como *{profile['name']}*!{couple_info}\n\n"
            "Use o menu abaixo para registrar gastos.",
            parse_mode="Markdown",
            reply_markup=keyboards.main_menu(),
        )
        return ConversationHandler.END

    await update.message.reply_text(
        "🔐 *Login no FinCouple*\n\n"
        "Digite o e-mail que você cadastrou no site:",
        parse_mode="Markdown",
    )
    return LOGIN_EMAIL


async def receive_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    email = update.message.text.strip().lower()
    profile_doc = db.profiles.find_one({"email": email})

    if not profile_doc:
        await update.message.reply_text(
            "❌ E-mail não encontrado.\n\nVerifique e tente novamente, ou /cancel para sair."
        )
        return LOGIN_EMAIL

    context.user_data["_login_uid"] = str(profile_doc["_id"])

    await update.message.reply_text(
        "🔑 Agora digite sua senha:\n\n"
        "_(A mensagem será apagada automaticamente por segurança)_",
        parse_mode="Markdown",
    )
    return LOGIN_PASSWORD


async def receive_password(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    password = update.message.text.strip()
    user_id = context.user_data.pop("_login_uid", None)
    tg_id = update.effective_user.id

    # Delete the password message immediately for security
    try:
        await update.message.delete()
    except Exception:
        pass

    if not user_id:
        await update.effective_chat.send_message(
            "Sessão expirada. Use /login para tentar novamente."
        )
        return ConversationHandler.END

    profile_doc = db.profiles.find_one({"_id": user_id})
    if not profile_doc or not verify_password(password, profile_doc.get("password_hash", "")):
        context.user_data["_login_uid"] = user_id  # keep email step done, only retry password
        await update.effective_chat.send_message(
            "❌ Senha incorreta. Tente novamente ou /cancel para sair."
        )
        return LOGIN_PASSWORD

    # Link this Telegram account to the profile
    db.profiles.update_one(
        {"_id": user_id},
        {"$set": {
            "telegram_id": tg_id,
            "telegram_username": update.effective_user.username,
            "telegram_first_name": update.effective_user.first_name,
        }},
    )
    clear_user_context(context)

    name = profile_doc.get("name", "")
    couple_info = ""
    couple_id = profile_doc.get("couple_id")
    if couple_id:
        couple = couple_service.get_couple(str(couple_id))
        if couple and couple.get("is_complete"):
            partner = couple_service.get_partner_profile(user_id, couple)
            if partner:
                couple_info = f"\n👫 Parceiro(a): *{partner['name']}*"

    await update.effective_chat.send_message(
        f"✅ *Login realizado com sucesso!*\n\n"
        f"Bem-vindo(a), *{name}*! 👋{couple_info}\n\n"
        "Agora você pode registrar gastos e controlar as finanças do casal diretamente pelo Telegram! 🎉",
        parse_mode="Markdown",
        reply_markup=keyboards.main_menu(),
    )
    return ConversationHandler.END


async def cancel_login(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.pop("_login_uid", None)
    await update.message.reply_text("Login cancelado.")
    return ConversationHandler.END
