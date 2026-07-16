import asyncio
import os
from dotenv import load_dotenv
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ConversationHandler,
    filters,
)

load_dotenv()

from backend.bot.states import (
    ONBOARD_NAME, ONBOARD_INCOME, ONBOARD_CHOICE, ONBOARD_TOKEN, ONBOARD_SPLIT,
    LOGIN_EMAIL, LOGIN_PASSWORD,
)
from backend.bot.handlers import onboarding
from backend.bot.handlers import login as login_handler
from backend.bot.handlers.user_context import load_user_context, clear_user_context
from backend.services import ai_assistant_service, audio_service, couple_service
from backend.mongo_client import db

# Ações da Fin que afetam dados do casal (não só consultas) — usadas para decidir
# quando avisar o parceiro sobre o que foi feito.
COUPLE_MUTATING_ACTIONS = {
    "add_bill", "pay_bill", "unpay_bill", "delete_bill",
    "create_goal", "contribute_goal", "delete_goal",
    "delete_expense",
    "create_category", "update_category", "delete_category",
}


def _action_succeeded(result: dict) -> bool:
    return result.get("ok", True) is not False and "error" not in result


def _should_notify_partner(action: dict) -> bool:
    result = action.get("result") or {}
    if not _action_succeeded(result):
        return False
    name = action.get("name")
    if name == "add_expense":
        return (action.get("args") or {}).get("split_type", "couple") == "couple"
    return name in COUPLE_MUTATING_ACTIONS


async def _typing_loop(context, chat_id: int, action: str = "typing"):
    """Mantém o indicador 'digitando...' vivo enquanto a Fin processa (Ollama/Whisper podem demorar)."""
    try:
        while True:
            await context.bot.send_chat_action(chat_id=chat_id, action=action)
            await asyncio.sleep(4)
    except asyncio.CancelledError:
        pass


async def _require_couple_context(update, context) -> dict | None:
    """Garante que quem está falando está logado e num casal completo; senão orienta e devolve None."""
    ctx = await load_user_context(update, context)
    if not ctx:
        await update.message.reply_text(
            "Oi! 👋 Para usar o FinCouple, primeiro se identifique:\n\n"
            "• /login — entrar com conta do site\n"
            "• /start — criar uma conta nova",
        )
        return None

    if not ctx["couple_complete"]:
        await update.message.reply_text(
            "Você ainda não está em um casal. Use /start para configurar.",
        )
        return None

    return ctx


async def handle_ai_message(update, context, text: str) -> None:
    """Ponto único de entrada da Fin: recebe texto (digitado ou transcrito de áudio),
    conversa com a IA e executa as ações que ela decidir via function-calling."""
    ctx = await _require_couple_context(update, context)
    if not ctx:
        return

    history: list[dict] = context.user_data.setdefault("_chat_history", [])

    typing_task = asyncio.create_task(_typing_loop(context, update.effective_chat.id))
    try:
        result = await asyncio.to_thread(
            ai_assistant_service.chat,
            couple_id=ctx["couple_id"],
            current_user_id=ctx["user_id"],
            user_message=text,
            history=history,
        )
    except ai_assistant_service.OllamaUnavailable as exc:
        await update.message.reply_text(f"⚠️ {exc}")
        return
    finally:
        typing_task.cancel()

    reply = result["reply"]
    history.append({"role": "user", "content": text})
    history.append({"role": "assistant", "content": reply})
    del history[:-10]

    await update.message.reply_text(reply)

    partner_telegram_id = ctx.get("partner_telegram_id")
    if partner_telegram_id and any(_should_notify_partner(a) for a in result.get("action_results", [])):
        await context.bot.send_message(
            chat_id=partner_telegram_id,
            text=f"{ctx['user_name']} usou a Fin: {reply}",
        )


async def handle_text_message(update, context) -> None:
    if not update.message or not update.message.text:
        return
    await handle_ai_message(update, context, update.message.text)


async def handle_voice_message(update, context) -> None:
    if not update.message or not (update.message.voice or update.message.audio):
        return

    ctx = await _require_couple_context(update, context)
    if not ctx:
        return

    tg_file = update.message.voice or update.message.audio

    typing_task = asyncio.create_task(_typing_loop(context, update.effective_chat.id, action="record_voice"))
    try:
        file = await context.bot.get_file(tg_file.file_id)
        audio_bytes = bytes(await file.download_as_bytearray())
        text = await asyncio.to_thread(audio_service.transcribe, audio_bytes, "voice.ogg")
    except audio_service.TranscriptionUnavailable as exc:
        await update.message.reply_text(f"🎙️⚠️ {exc}")
        return
    finally:
        typing_task.cancel()

    await handle_ai_message(update, context, text)


def build_onboarding_handler() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CommandHandler("start", onboarding.start)],
        states={
            ONBOARD_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, onboarding.receive_name)],
            ONBOARD_INCOME: [MessageHandler(filters.TEXT & ~filters.COMMAND, onboarding.receive_income)],
            ONBOARD_CHOICE: [
                CallbackQueryHandler(onboarding.choice_create, pattern="^onboard:create$"),
                CallbackQueryHandler(onboarding.choice_join, pattern="^onboard:join$"),
            ],
            ONBOARD_TOKEN: [MessageHandler(filters.TEXT & ~filters.COMMAND, onboarding.receive_token)],
            ONBOARD_SPLIT: [CallbackQueryHandler(onboarding.receive_split, pattern="^onboard:split:")],
        },
        fallbacks=[CommandHandler("cancel", onboarding.cancel)],
        allow_reentry=True,
    )


def build_login_handler() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CommandHandler("login", login_handler.start_login)],
        states={
            LOGIN_EMAIL:    [MessageHandler(filters.TEXT & ~filters.COMMAND, login_handler.receive_email)],
            LOGIN_PASSWORD: [MessageHandler(filters.TEXT & ~filters.COMMAND, login_handler.receive_password)],
        },
        fallbacks=[CommandHandler("cancel", login_handler.cancel_login)],
        allow_reentry=True,
    )


async def handle_logout(update, context):
    """Unlink this Telegram account from the FinCouple profile."""
    tg_id = update.effective_user.id
    profile = couple_service.get_profile_by_telegram(tg_id)
    if not profile:
        await update.message.reply_text(
            "Você não está conectado a nenhuma conta.\n\nUse /login para entrar."
        )
        return
    db.profiles.update_one(
        {"_id": profile["id"]},
        {"$unset": {"telegram_id": "", "telegram_username": "", "telegram_first_name": ""}},
    )
    clear_user_context(context)
    await update.message.reply_text(
        f"👋 Conta de *{profile['name']}* desvinculada do Telegram.\n\n"
        "Use /login para reconectar quando quiser.",
        parse_mode="Markdown",
    )


async def handle_status(update, context):
    """Show who the current user is and their couple status."""
    ctx = await load_user_context(update, context)
    if not ctx:
        await update.message.reply_text(
            "Você não está conectado.\n\n"
            "• /login — entrar com sua conta do site\n"
            "• /start — criar uma conta nova",
        )
        return

    partner = ctx["partner_name"] or "Aguardando parceiro(a)..."
    status_icon = "✅" if ctx["couple_complete"] else "⏳"

    await update.message.reply_text(
        f"👤 *{ctx['user_name']}*\n"
        f"👫 Parceiro(a): {partner}\n"
        f"{status_icon} Casal: {'conectado' if ctx['couple_complete'] else 'incompleto'}\n\n"
        "Fale ou mande um áudio pra Fin — ela cuida do resto.",
        parse_mode="Markdown",
    )


async def handle_help(update, context):
    await update.message.reply_text(
        "🤖 *FinCouple — Fin*\n\n"
        "Fale ou mande um áudio 🎙️ que a Fin lança gastos, paga contas, cria metas, "
        "gerencia categorias e explica seu resumo. Ex:\n"
        "• `50 no mercado`\n"
        "• `paguei a conta de luz`\n"
        "• `quero juntar 3 mil pra viagem`\n"
        "• `como está nosso mês?`\n\n"
        "*Comandos:*\n"
        "/start — criar conta ou ver status\n"
        "/login — entrar com conta existente do site\n"
        "/logout — desvincular esta conta do Telegram\n"
        "/status — ver sua conta e casal\n"
        "/cancel — cancelar operação atual (onboarding/login)",
        parse_mode="Markdown",
    )


async def main():
    token = os.getenv("BOT_TOKEN")
    if not token:
        raise RuntimeError("BOT_TOKEN não configurado no .env")

    app = Application.builder().token(token).build()

    # Conversation handlers (order matters — more specific first)
    app.add_handler(build_login_handler())
    app.add_handler(build_onboarding_handler())

    # Simple command handlers
    app.add_handler(CommandHandler("logout", handle_logout))
    app.add_handler(CommandHandler("status", handle_status))
    app.add_handler(CommandHandler("help", handle_help))

    # Tudo mais (texto livre e áudio) vai pra Fin
    app.add_handler(MessageHandler(filters.VOICE | filters.AUDIO, handle_voice_message))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))

    # Register bot commands in Telegram menu
    await app.bot.set_my_commands([
        ("start",  "Criar conta ou ver status"),
        ("login",  "Entrar com conta do site"),
        ("status", "Ver sua conta e casal"),
        ("logout", "Desvincular conta do Telegram"),
        ("help",   "Ajuda e comandos"),
        ("cancel", "Cancelar operação atual"),
    ])

    async with app:
        await app.start()
        await app.updater.start_polling(drop_pending_updates=True)
        print("Bot iniciado! Pressione Ctrl+C para parar.")
        await asyncio.Event().wait()


if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(main())
