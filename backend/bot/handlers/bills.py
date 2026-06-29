from datetime import date
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler
from backend.services import bill_service
from backend.bot.states import BILL_NAME, BILL_AMOUNT, BILL_DUE_DAY
from backend.bot import keyboards
from backend.bot.handlers.user_context import load_user_context


async def show_bills(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    today = date.today()

    ctx = await load_user_context(update, context)
    if not ctx or not ctx["couple_id"]:
        await query.edit_message_text("Você precisa estar em um casal. Use /start")
        return

    bills = bill_service.get_couple_bills(ctx["couple_id"], today.month, today.year)
    paid_ids = {b["id"] for b in bills if b.get("is_paid")}

    if not bills:
        await query.edit_message_text(
            "Nenhuma conta fixa cadastrada.",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("➕ Adicionar conta", callback_data="bill:new"),
                InlineKeyboardButton("🏠 Menu", callback_data="menu:main"),
            ]])
        )
        return

    total = sum(float(b["amount"]) for b in bills)
    paid = sum(float(b["amount"]) for b in bills if b["id"] in paid_ids)
    lines = [f"📋 *Contas do mês* ({today.strftime('%B/%Y')})\n"]
    lines.append(f"Total: R$ {total:.2f} | Pago: R$ {paid:.2f} | Pendente: R$ {total - paid:.2f}\n")
    for bill in bills:
        status = "✅" if bill["id"] in paid_ids else "⏳"
        lines.append(f"{status} {bill['name']} — R$ {float(bill['amount']):.2f} (dia {bill['due_day']})")

    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            f"{'Desmarcar' if b['id'] in paid_ids else 'Marcar como pago'}: {b['name']}",
            callback_data=f"bill:toggle:{b['id']}"
        )] for b in bills
    ] + [[
        InlineKeyboardButton("➕ Nova conta", callback_data="bill:new"),
        InlineKeyboardButton("🏠 Menu", callback_data="menu:main"),
    ]])

    await query.edit_message_text("\n".join(lines), parse_mode="Markdown", reply_markup=kb)


async def toggle_bill(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    bill_id = query.data.split(":")[2]
    today = date.today()

    ctx = await load_user_context(update, context)
    if not ctx:
        await query.edit_message_text("Usuário não identificado. Use /start")
        return

    existing = bill_service.get_bill_payment(bill_id, today.month, today.year)
    if existing:
        bill_service.unmark_bill_paid(bill_id, today.month, today.year)
    else:
        bill_service.mark_bill_paid(bill_id, ctx["user_id"], today.month, today.year)

    await show_bills(update, context)


async def start_add_bill(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("📋 Qual o nome da conta? (ex: Aluguel, Internet, Netflix)")
    return BILL_NAME


async def receive_bill_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["bill_name"] = update.message.text.strip()
    await update.message.reply_text(f"Qual o valor mensal de '{context.user_data['bill_name']}'? (ex: 1500)")
    return BILL_AMOUNT


async def receive_bill_amount(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip().replace(",", ".").replace("R$", "").strip()
    try:
        context.user_data["bill_amount"] = float(text)
    except ValueError:
        await update.message.reply_text("Valor inválido. Ex: 1500")
        return BILL_AMOUNT
    await update.message.reply_text("Qual o dia do vencimento? (1 a 31)")
    return BILL_DUE_DAY


async def receive_bill_due_day(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        day = int(update.message.text.strip())
        if not 1 <= day <= 31:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Digite um dia válido entre 1 e 31.")
        return BILL_DUE_DAY

    ctx = await load_user_context(update, context)
    if not ctx or not ctx["couple_id"]:
        await update.message.reply_text("Você precisa estar em um casal. Use /start")
        return ConversationHandler.END

    bill = bill_service.add_bill(
        ctx["couple_id"],
        context.user_data["bill_name"],
        context.user_data["bill_amount"],
        day,
    )

    await update.message.reply_text(
        f"✅ Conta '{bill['name']}' de R$ {float(bill['amount']):.2f} (dia {bill['due_day']}) adicionada!",
        reply_markup=keyboards.main_menu(),
    )
    context.user_data.clear()
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Cancelado.", reply_markup=keyboards.main_menu())
    return ConversationHandler.END
