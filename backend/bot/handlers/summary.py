from datetime import date
from telegram import Update
from telegram.ext import ContextTypes
from backend.services import summary_service
from backend.bot import keyboards
from backend.bot.handlers.user_context import load_user_context

MONTH_NAMES = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]


async def show_summary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    today = date.today()

    ctx = await load_user_context(update, context)
    if not ctx or not ctx["couple_id"]:
        await query.edit_message_text("Você precisa estar em um casal. Use /start")
        return

    data = summary_service.get_monthly_summary(ctx["couple_id"], today.month, today.year)

    if not data:
        await query.edit_message_text("Sem dados para exibir.", reply_markup=keyboards.back_to_menu())
        return

    lines = [
        f"📊 *Resumo de {MONTH_NAMES[data['month']]}/{data['year']}*\n",
        f"💸 Total gasto: R$ {data['total_expenses']:.2f}",
        f"👤 {data['user1_name']} pagou: R$ {data['user1_paid']:.2f}",
        f"👤 {data['user2_name']} pagou: R$ {data['user2_paid']:.2f}",
        f"\n⚖️ {data['balance_description']}",
    ]

    if data["by_category"]:
        lines.append("\n🏷 *Por categoria:*")
        for cat, val in list(data["by_category"].items())[:5]:
            lines.append(f"  • {cat}: R$ {val:.2f}")

    if data["bills_total"] > 0:
        lines.append("\n📋 *Contas fixas:*")
        lines.append(f"  Pagas: R$ {data['bills_paid']:.2f} / R$ {data['bills_total']:.2f}")
        if data["bills_pending"] > 0:
            lines.append(f"  ⚠️ Pendente: R$ {data['bills_pending']:.2f}")

    if data["goals"]:
        lines.append("\n🎯 *Metas:*")
        for g in data["goals"][:3]:
            lines.append(f"  {g['emoji']} {g['name']}: {g['percent']}%")

    await query.edit_message_text(
        "\n".join(lines),
        parse_mode="Markdown",
        reply_markup=keyboards.back_to_menu(),
    )
