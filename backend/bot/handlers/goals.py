from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from backend.services import goal_service
from backend.mongo_client import db
from bson import ObjectId
from backend.bot.states import GOAL_NAME, GOAL_TARGET, CONTRIB_AMOUNT
from backend.bot import keyboards
from backend.bot.handlers.user_context import load_user_context


async def show_goals(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    ctx = await load_user_context(update, context)
    if not ctx or not ctx["couple_id"]:
        await query.edit_message_text("Voce precisa estar em um casal. Use /start")
        return

    goals = goal_service.get_couple_goals(ctx["couple_id"])

    if not goals:
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup
        await query.edit_message_text(
            "Nenhuma meta criada ainda.",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("+ Criar meta", callback_data="goal:new"),
                InlineKeyboardButton("Menu", callback_data="menu:main"),
            ]])
        )
        return

    goal_list = [
        {
            "id": g["id"],
            "name": g["name"],
            "emoji": g.get("emoji", ""),
            "current": float(g["current_amount"]),
            "target": float(g["target_amount"]),
        }
        for g in goals
    ]

    lines = ["Metas do casal\n"]
    for g in goals:
        current = float(g["current_amount"])
        target = float(g["target_amount"])
        pct = min(100, int((current / target) * 100)) if target > 0 else 0
        remaining = target - current
        lines.append(f"{g.get('emoji', '')} {g['name']}")
        lines.append(f"  R$ {current:.2f} / R$ {target:.2f} ({pct}%)")
        lines.append(f"  Falta: R$ {remaining:.2f}\n")

    await query.edit_message_text(
        "\n".join(lines),
        reply_markup=keyboards.goals_list(goal_list),
    )


async def start_add_goal(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("Qual o nome da meta? (ex: Viagem para o Nordeste, Carro, Casamento)")
    return GOAL_NAME


async def receive_goal_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["goal_name"] = update.message.text.strip()
    await update.message.reply_text(f"Qual o valor total da meta '{context.user_data['goal_name']}'? (ex: 5000)")
    return GOAL_TARGET


async def receive_goal_target(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip().replace(",", ".").replace("R$", "").strip()
    try:
        context.user_data["goal_target"] = float(text)
    except ValueError:
        await update.message.reply_text("Valor invalido. Ex: 5000")
        return GOAL_TARGET

    ctx = await load_user_context(update, context)
    if not ctx or not ctx["couple_id"]:
        await update.message.reply_text("Voce precisa estar em um casal. Use /start")
        return ConversationHandler.END

    goal = goal_service.create_goal(
        ctx["couple_id"],
        context.user_data["goal_name"],
        context.user_data["goal_target"],
    )

    await update.message.reply_text(
        f"Meta '{goal['name']}' de R$ {float(goal['target_amount']):.2f} criada!\n\n"
        "Use o menu para adicionar contribuicoes.",
        reply_markup=keyboards.main_menu(),
    )
    context.user_data.clear()
    return ConversationHandler.END


async def start_contribution(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    # goal_id is now an ObjectId hex string
    goal_id = query.data.split(":")[2]
    context.user_data["contrib_goal_id"] = goal_id

    goal_doc = db.goals.find_one({"_id": ObjectId(goal_id)})
    name = goal_doc["name"] if goal_doc else ""
    current = float(goal_doc["current_amount"]) if goal_doc else 0
    target = float(goal_doc["target_amount"]) if goal_doc else 0

    await query.edit_message_text(
        f"Quanto voce quer adicionar a meta '{name}'?\n\n"
        f"Progresso atual: R$ {current:.2f} / R$ {target:.2f}"
    )
    return CONTRIB_AMOUNT


async def receive_contribution(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip().replace(",", ".").replace("R$", "").strip()
    try:
        amount = float(text)
    except ValueError:
        await update.message.reply_text("Valor invalido.")
        return CONTRIB_AMOUNT

    ctx = await load_user_context(update, context)
    if not ctx:
        await update.message.reply_text("Usuario nao identificado. Use /start")
        return ConversationHandler.END

    goal_id = context.user_data["contrib_goal_id"]
    updated_goal = goal_service.add_contribution(goal_id, ctx["user_id"], amount)

    if updated_goal and updated_goal.get("is_completed"):
        msg = f"META ALCANCADA! '{updated_goal['name']}' foi concluida! Parabens ao casal!"
    elif updated_goal:
        current = float(updated_goal["current_amount"])
        target = float(updated_goal["target_amount"])
        remaining = target - current
        pct = min(100, int((current / target) * 100)) if target > 0 else 0
        msg = (
            f"R$ {amount:.2f} adicionado a meta '{updated_goal['name']}'!\n\n"
            f"Progresso: R$ {current:.2f} / R$ {target:.2f} ({pct}%)\n"
            f"Falta: R$ {remaining:.2f}"
        )
    else:
        msg = f"R$ {amount:.2f} adicionado!"

    await update.message.reply_text(msg, reply_markup=keyboards.main_menu())
    context.user_data.clear()
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Cancelado.", reply_markup=keyboards.main_menu())
    return ConversationHandler.END
