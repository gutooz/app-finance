from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from backend.services import couple_service, telegram_link_service
from backend.bot.states import ONBOARD_NAME, ONBOARD_INCOME, ONBOARD_CHOICE, ONBOARD_TOKEN, ONBOARD_SPLIT
from backend.bot import keyboards
from backend.bot.handlers.user_context import clear_user_context


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    tg_id = update.effective_user.id
    args = context.args or []

    if args:
        start_token = args[0]
        linked_profile = telegram_link_service.consume_telegram_link(
            token=start_token,
            telegram_id=tg_id,
            telegram_username=update.effective_user.username,
            telegram_first_name=update.effective_user.first_name,
        )
        if linked_profile:
            await update.message.reply_text(
                f"Telegram conectado com sucesso, {linked_profile['name']}!\n\n"
                "A partir de agora voce pode registrar gastos por aqui.\n"
                "Ex: `50 mercado` ou `nosso aluguel 2200`",
                parse_mode="Markdown",
                reply_markup=keyboards.main_menu(),
            )
            return ConversationHandler.END
        context.user_data["invite_token"] = start_token

    profile = couple_service.get_profile_by_telegram(tg_id)

    # Registered + in a complete couple → show menu
    if profile and profile.get("couple_id"):
        couple = couple_service.get_couple(profile["couple_id"])
        if couple and couple.get("is_complete"):
            partner = couple_service.get_partner_profile(profile["id"], couple)
            await update.message.reply_text(
                f"Olá, {profile['name']}! 👋\n\n"
                f"Parceiro(a): {partner['name'] if partner else '—'}\n"
                "O que você quer fazer?",
                reply_markup=keyboards.main_menu(),
            )
            return ConversationHandler.END

    # Has invite token in the deep link → start join flow
    if context.user_data.get("invite_token"):
        token = context.user_data["invite_token"]
        couple = couple_service.get_couple_by_token(token)
        if couple and not couple.get("is_complete"):
            user1 = couple_service.get_profile(couple["user1_id"])
            context.user_data["joining_couple_id"] = couple["id"]
            name_prompt = f"Você foi convidado(a) por {user1['name'] if user1 else 'seu parceiro(a)'}! 💕\n\n"
            if profile:
                # Already registered → go straight to split choice
                await update.message.reply_text(
                    name_prompt + "Como vocês querem dividir as despesas?",
                    reply_markup=keyboards.split_mode(),
                )
                return ONBOARD_SPLIT
            await update.message.reply_text(name_prompt + "Como você se chama?")
            return ONBOARD_NAME

    # Not registered at all
    if not profile:
        await update.message.reply_text(
            "💕 Olá! Sou o *FinCouple*, seu assistente financeiro para casais.\n\n"
            "Já tem conta no site? Use /login para entrar.\n\n"
            "Primeira vez aqui? Vamos começar! Como você se chama?",
            parse_mode="Markdown",
        )
        return ONBOARD_NAME

    # Registered but no couple yet
    await update.message.reply_text(
        f"Bem-vindo(a) de volta, {profile['name']}! 👋\n\nVocê ainda não está em um casal.",
        reply_markup=keyboards.create_or_join(),
    )
    return ONBOARD_CHOICE


async def receive_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["name"] = update.message.text.strip()
    await update.message.reply_text(
        f"Oi, {context.user_data['name']}! 😊\n\nQuanto você ganha por mês? (ex: 3500)"
    )
    return ONBOARD_INCOME


async def receive_income(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip().replace(",", ".").replace("R$", "").strip()
    try:
        income = float(text)
    except ValueError:
        await update.message.reply_text("Por favor, digite um valor numérico. Ex: 3500")
        return ONBOARD_INCOME

    context.user_data["income"] = income

    # If joining an existing couple, skip create/join step
    if context.user_data.get("joining_couple_id"):
        await update.message.reply_text(
            "Como vocês querem dividir as despesas do casal?",
            reply_markup=keyboards.split_mode(),
        )
        return ONBOARD_SPLIT

    await update.message.reply_text(
        "Você quer criar um novo casal ou entrar em um já existente?",
        reply_markup=keyboards.create_or_join(),
    )
    return ONBOARD_CHOICE


async def choice_create(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    tg_id = update.effective_user.id

    profile = couple_service.get_profile_by_telegram(tg_id) or couple_service.create_telegram_user(
        tg_id, context.user_data["name"], context.user_data["income"]
    )
    couple = couple_service.create_couple(profile["id"])
    token = couple["invite_token"]

    clear_user_context(context)

    bot_name = (await context.bot.get_me()).username
    invite_link = f"https://t.me/{bot_name}?start={token}"
    completion = telegram_link_service.create_profile_completion_link(profile["id"])

    await query.edit_message_text(
        f"Casal criado! 🎉\n\n"
        f"Envie este link para seu(sua) parceiro(a):\n\n"
        f"`{invite_link}`\n\n"
        f"Ou o código: `{token}`\n\n"
        f"Finalize seu acesso Web aqui:\n{completion['url']}\n\n"
        "Aguardando seu(sua) parceiro(a)...",
        parse_mode="Markdown",
    )
    return ConversationHandler.END


async def choice_join(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("Digite o código de convite que seu(sua) parceiro(a) te enviou:")
    return ONBOARD_TOKEN


async def receive_token(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    token = update.message.text.strip()
    couple = couple_service.get_couple_by_token(token)
    if not couple or couple.get("is_complete"):
        await update.message.reply_text(
            "Código inválido ou já usado. Tente novamente ou peça um novo link."
        )
        return ONBOARD_TOKEN

    user1 = couple_service.get_profile(couple["user1_id"])
    context.user_data["joining_couple_id"] = couple["id"]

    await update.message.reply_text(
        f"Ótimo! Você vai se juntar ao casal de {user1['name'] if user1 else 'seu parceiro(a)'}! 💕\n\n"
        "Como vocês querem dividir as despesas?",
        reply_markup=keyboards.split_mode(),
    )
    return ONBOARD_SPLIT


async def receive_split(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    split_mode = query.data.split(":")[2]
    tg_id = update.effective_user.id
    couple_id = context.user_data.get("joining_couple_id")

    profile = couple_service.get_profile_by_telegram(tg_id) or couple_service.create_telegram_user(
        tg_id, context.user_data.get("name", ""), context.user_data.get("income", 0)
    )

    couple = couple_service.get_couple(couple_id)
    user1 = couple_service.get_profile(couple["user1_id"]) if couple else None
    couple_service.join_couple(couple_id, profile["id"], split_mode)
    completion = telegram_link_service.create_profile_completion_link(profile["id"])

    clear_user_context(context)

    mode_label = "50/50" if split_mode == "50_50" else "Proporcional à renda"
    await query.edit_message_text(
        f"Perfeito! Vocês estão conectados! 🎉\n\n"
        f"Parceiro(a): {user1['name'] if user1 else '—'}\n"
        f"Divisão: {mode_label}\n\n"
        f"Agora é só registrar os gastos juntos!\n\n"
        f"Finalize seu acesso Web aqui:\n{completion['url']}",
        reply_markup=keyboards.main_menu(),
    )
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Operação cancelada.")
    return ConversationHandler.END
