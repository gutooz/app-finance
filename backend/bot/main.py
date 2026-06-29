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
    EXP_AMOUNT, EXP_CATEGORY, EXP_PAID_BY, EXP_SPLIT,
    BILL_NAME, BILL_AMOUNT, BILL_DUE_DAY,
    GOAL_NAME, GOAL_TARGET, CONTRIB_AMOUNT,
    LOGIN_EMAIL, LOGIN_PASSWORD,
)
from backend.bot.handlers import onboarding, expenses, bills, goals, summary
from backend.bot.handlers import login as login_handler
from backend.bot.handlers.natural_language import parse_expense
from backend.bot.handlers.user_context import load_user_context, clear_user_context
from backend.bot import keyboards
from backend.services import expense_service, transaction_service, couple_service
from backend.mongo_client import db


async def handle_nl_message(update, context):
    """Fallback: parse natural-language expense and register it immediately."""
    if not update.message or not update.message.text:
        return

    # Always check authentication first
    ctx = await load_user_context(update, context)
    if not ctx:
        await update.message.reply_text(
            "Oi! 👋 Para usar o FinCouple, primeiro se identifique:\n\n"
            "• /login — entrar com conta do site\n"
            "• /start — criar uma conta nova",
        )
        return

    if not ctx["couple_complete"]:
        await update.message.reply_text(
            "Voce ainda nao esta em um casal. Use /start para configurar.",
        )
        return

    parsed = parse_expense(update.message.text)
    if not parsed:
        await update.message.reply_text(
            f"Oi, {ctx['user_name']}! Use os botoes do menu ou envie um gasto rapido.\n"
            "Ex: '72 mercado' ou 'aluguel 2000'",
            reply_markup=keyboards.main_menu(),
        )
        return

    if parsed.get("type") == "income":
        transaction_service.add_transaction(
            user_id=ctx["user_id"],
            couple_id=ctx["couple_id"] if parsed.get("split_type") == "couple" else None,
            paid_by_id=ctx["user_id"],
            amount=parsed["amount"],
            transaction_type="income",
            scope="shared" if parsed.get("split_type") == "couple" else "personal",
            category=parsed["category"],
            description=parsed.get("description", ""),
            transaction_date=parsed.get("date"),
            source="telegram",
            raw_message=update.message.text,
        )
        await update.message.reply_text(
            f"✅ Receita de R$ {parsed['amount']:.2f} salva!",
            reply_markup=keyboards.main_menu(),
        )
        return

    expense_service.add_expense(
        couple_id=ctx["couple_id"],
        paid_by_id=ctx["user_id"],
        amount=parsed["amount"],
        category=parsed["category"],
        description=parsed.get("description", ""),
        split_type=parsed.get("split_type", "couple"),
        expense_date=parsed.get("date"),
        source="telegram",
    )

    desc_line = f"\n_{parsed['description']}_" if parsed.get("description") else ""
    scope_label = "do casal" if parsed.get("split_type") == "couple" else "pessoal"
    await update.message.reply_text(
        f"✅ R$ {parsed['amount']:.2f} em *{parsed['category']}* salvo como {scope_label}!{desc_line}",
        parse_mode="Markdown",
        reply_markup=keyboards.main_menu(),
    )

    partner_telegram_id = ctx.get("partner_telegram_id")
    if parsed.get("split_type") == "couple" and partner_telegram_id:
        await context.bot.send_message(
            chat_id=partner_telegram_id,
            text=(
                f"{ctx['user_name']} registrou R$ {parsed['amount']:.2f} "
                f"em {parsed['category']} na carteira do casal."
            ),
        )


async def handle_menu_callback(update, context):
    query = update.callback_query
    data = query.data

    if data == "menu:main":
        await query.answer()
        await query.edit_message_text("O que você quer fazer?", reply_markup=keyboards.main_menu())
    elif data == "menu:bills":
        await bills.show_bills(update, context)
    elif data == "menu:goals":
        await goals.show_goals(update, context)
    elif data == "menu:summary":
        await summary.show_summary(update, context)
    elif data.startswith("bill:toggle:"):
        await bills.toggle_bill(update, context)
    elif data.startswith("goal:contrib:"):
        await goals.start_contribution(update, context)


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


def build_expense_handler() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CallbackQueryHandler(expenses.start_expense, pattern="^menu:expense$")],
        states={
            EXP_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, expenses.receive_amount)],
            EXP_CATEGORY: [CallbackQueryHandler(expenses.receive_category, pattern="^exp:cat:")],
            EXP_PAID_BY: [CallbackQueryHandler(expenses.receive_paid_by, pattern="^exp:paid:")],
            EXP_SPLIT: [
                CallbackQueryHandler(expenses.receive_split, pattern="^exp:split:"),
                CallbackQueryHandler(expenses.confirm_expense, pattern="^exp:(confirm|cancel)$"),
            ],
        },
        fallbacks=[CommandHandler("cancel", expenses.cancel)],
    )


def build_bill_handler() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CallbackQueryHandler(bills.start_add_bill, pattern="^bill:new$")],
        states={
            BILL_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, bills.receive_bill_name)],
            BILL_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, bills.receive_bill_amount)],
            BILL_DUE_DAY: [MessageHandler(filters.TEXT & ~filters.COMMAND, bills.receive_bill_due_day)],
        },
        fallbacks=[CommandHandler("cancel", bills.cancel)],
    )


def build_goal_handler() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CallbackQueryHandler(goals.start_add_goal, pattern="^goal:new$")],
        states={
            GOAL_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, goals.receive_goal_name)],
            GOAL_TARGET: [MessageHandler(filters.TEXT & ~filters.COMMAND, goals.receive_goal_target)],
        },
        fallbacks=[CommandHandler("cancel", goals.cancel)],
    )


def build_contrib_handler() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CallbackQueryHandler(goals.start_contribution, pattern="^goal:contrib:")],
        states={
            CONTRIB_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, goals.receive_contribution)],
        },
        fallbacks=[CommandHandler("cancel", goals.cancel)],
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
        "Use o menu abaixo:",
        parse_mode="Markdown",
        reply_markup=keyboards.main_menu(),
    )


async def handle_help(update, context):
    await update.message.reply_text(
        "🤖 *FinCouple Bot*\n\n"
        "*Comandos:*\n"
        "/start — criar conta ou ver menu\n"
        "/login — entrar com conta existente do site\n"
        "/logout — desvincular esta conta do Telegram\n"
        "/status — ver sua conta e casal\n"
        "/cancel — cancelar operação atual\n\n"
        "*Registro rápido de gastos:*\n"
        "Basta enviar uma mensagem como:\n"
        "• `50 mercado`\n"
        "• `gastei 120 no restaurante`\n"
        "• `uber 35`\n"
        "• `aluguel 2000 casal`",
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
    app.add_handler(build_expense_handler())
    app.add_handler(build_bill_handler())
    app.add_handler(build_goal_handler())
    app.add_handler(build_contrib_handler())

    # Simple command handlers
    app.add_handler(CommandHandler("logout", handle_logout))
    app.add_handler(CommandHandler("status", handle_status))
    app.add_handler(CommandHandler("help", handle_help))

    # Inline keyboard callbacks and free-text fallback
    app.add_handler(CallbackQueryHandler(handle_menu_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_nl_message))

    # Register bot commands in Telegram menu
    await app.bot.set_my_commands([
        ("start",  "Criar conta ou ver menu"),
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
