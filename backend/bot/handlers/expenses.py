from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from backend.services import expense_service
from backend.bot.states import EXP_AMOUNT, EXP_CATEGORY, EXP_PAID_BY, EXP_SPLIT
from backend.bot import keyboards
from backend.bot.handlers.natural_language import parse_expense
from backend.bot.handlers.user_context import load_user_context


async def start_expense(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if query:
        await query.answer()
        await query.edit_message_text("💸 Qual o valor do gasto? (ex: 72.50)")
    else:
        await update.message.reply_text("💸 Qual o valor do gasto? (ex: 72.50)")
    return EXP_AMOUNT


async def receive_amount(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip().replace(",", ".").replace("R$", "").strip()

    ctx = await load_user_context(update, context)
    if not ctx or not ctx["couple_complete"]:
        await update.message.reply_text("Você precisa estar em um casal. Use /start")
        return ConversationHandler.END

    partner_name = ctx["partner_name"] or "Parceiro(a)"

    # Natural language with a recognized category
    parsed = parse_expense(text)
    if parsed and parsed["category"] != "outros":
        context.user_data["exp_amount"] = parsed["amount"]
        context.user_data["exp_category"] = parsed["category"]
        context.user_data["exp_description"] = parsed.get("description", "")
        await update.message.reply_text(
            f"Entendi! R$ {parsed['amount']:.2f} em {parsed['category']}.\n\nQuem pagou?",
            reply_markup=keyboards.paid_by(ctx["user_name"], partner_name),
        )
        return EXP_PAID_BY

    # Plain number
    try:
        amount = float(text)
        if amount <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Digite um valor válido. Ex: 72.50")
        return EXP_AMOUNT

    context.user_data["exp_amount"] = amount
    context.user_data["exp_description"] = ""
    await update.message.reply_text("Qual a categoria?", reply_markup=keyboards.category())
    return EXP_CATEGORY


async def receive_category(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data["exp_category"] = query.data.split(":")[2]

    ctx = await load_user_context(update, context)
    user_name = ctx["user_name"] if ctx else "Você"
    partner_name = (ctx["partner_name"] if ctx else None) or "Parceiro(a)"

    await query.edit_message_text(
        "Quem pagou?",
        reply_markup=keyboards.paid_by(user_name, partner_name),
    )
    return EXP_PAID_BY


async def receive_paid_by(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data["exp_paid_by"] = query.data.split(":")[2]  # "me" or "partner"
    await query.edit_message_text("Esse gasto é:", reply_markup=keyboards.split_type())
    return EXP_SPLIT


async def receive_split(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    split = query.data.split(":")[2]
    context.user_data["exp_split"] = split

    ctx = await load_user_context(update, context)
    partner_name = (ctx["partner_name"] if ctx else None) or "Parceiro(a)"

    amount = context.user_data["exp_amount"]
    category = context.user_data["exp_category"]
    paid_by = context.user_data["exp_paid_by"]

    split_labels = {"couple": "do casal", "mine": "só meu", "partners": f"só de {partner_name}"}
    payer_label = "Você" if paid_by == "me" else partner_name

    await query.edit_message_text(
        f"*Confirmação:*\n\n"
        f"💰 R$ {amount:.2f}\n"
        f"🏷 {category}\n"
        f"👤 {payer_label}\n"
        f"➗ {split_labels.get(split, split)}",
        parse_mode="Markdown",
        reply_markup=keyboards.confirm_expense(),
    )
    return EXP_SPLIT


async def confirm_expense(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    if query.data == "exp:cancel":
        await query.edit_message_text("Gasto cancelado.")
        return ConversationHandler.END

    ctx = await load_user_context(update, context)
    if not ctx or not ctx["couple_complete"]:
        await query.edit_message_text("Erro: usuário não identificado. Use /start")
        return ConversationHandler.END

    paid_by_key = context.user_data["exp_paid_by"]
    paid_by_id = ctx["user_id"] if paid_by_key == "me" else (ctx["partner_id"] or ctx["user_id"])

    expense_service.add_expense(
        couple_id=ctx["couple_id"],
        paid_by_id=paid_by_id,
        amount=context.user_data["exp_amount"],
        category=context.user_data["exp_category"],
        description=context.user_data.get("exp_description", ""),
        split_type=context.user_data["exp_split"],
        source="telegram",
    )

    await query.edit_message_text(
        f"✅ R$ {context.user_data['exp_amount']:.2f} salvo!\n\nO que mais?",
        reply_markup=keyboards.main_menu(),
    )
    # Clear only expense keys; keep _uctx cache
    for key in ("exp_amount", "exp_category", "exp_paid_by", "exp_split", "exp_description"):
        context.user_data.pop(key, None)
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Cancelado.", reply_markup=keyboards.main_menu())
    return ConversationHandler.END
