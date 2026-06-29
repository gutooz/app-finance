from backend.services import couple_service

_KEY = "_uctx"


async def load_user_context(update, context) -> dict | None:
    """
    Identify the registered user for the current Telegram message.
    Caches the result in context.user_data so subsequent messages in the
    same session don't hit the database again.

    Returns a dict with user info, or None if the Telegram user is not
    registered yet.
    """
    if _KEY in context.user_data:
        return context.user_data[_KEY]

    tg_id = update.effective_user.id
    profile = couple_service.get_profile_by_telegram(tg_id)
    if not profile:
        context.user_data[_KEY] = None
        return None

    couple = None
    partner = None
    if profile.get("couple_id"):
        couple = couple_service.get_couple(profile["couple_id"])
        if couple and couple.get("is_complete"):
            partner = couple_service.get_partner_profile(profile["id"], couple)

    ctx = {
        "user_id": profile["id"],
        "user_name": profile["name"],
        "couple_id": profile.get("couple_id"),
        "couple_complete": bool(couple and couple.get("is_complete")),
        "partner_id": partner["id"] if partner else None,
        "partner_name": partner["name"] if partner else None,
        "partner_telegram_id": partner.get("telegram_id") if partner else None,
    }
    context.user_data[_KEY] = ctx
    return ctx


def clear_user_context(context) -> None:
    """Invalidate the cached context (call after any profile or couple change)."""
    context.user_data.pop(_KEY, None)
