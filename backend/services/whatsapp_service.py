import hashlib
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import httpx

from backend.bot.handlers.natural_language import parse_expense
from backend.mongo_client import db
from backend.services import couple_service, expense_service, transaction_service

TOKEN_TTL_MINUTES = 15


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _digits(value: str | None) -> str:
    return re.sub(r"\D+", "", value or "")


def _get_text(message: dict) -> str:
    msg = message.get("message") or message.get("data", {}).get("message") or {}
    if isinstance(msg.get("conversation"), str):
        return msg["conversation"].strip()
    extended = msg.get("extendedTextMessage") or {}
    if isinstance(extended.get("text"), str):
        return extended["text"].strip()
    image = msg.get("imageMessage") or {}
    if isinstance(image.get("caption"), str):
        return image["caption"].strip()
    return ""


def _get_remote_jid(payload: dict) -> str:
    data = payload.get("data") or payload
    key = data.get("key") or {}
    return key.get("remoteJid") or data.get("remoteJid") or data.get("from") or ""


def _get_phone(payload: dict) -> str:
    return _digits(_get_remote_jid(payload).split("@", 1)[0])


def _is_from_me(payload: dict) -> bool:
    data = payload.get("data") or payload
    key = data.get("key") or {}
    return bool(key.get("fromMe") or data.get("fromMe"))


def _instance(payload: dict) -> str:
    return payload.get("instance") or os.getenv("EVOLUTION_INSTANCE_NAME", "fincouple")


def _reply_enabled() -> bool:
    return os.getenv("WHATSAPP_SEND_REPLIES", "true").lower() in ("1", "true", "yes", "on")


def _evolution_configured() -> bool:
    return bool(os.getenv("EVOLUTION_API_URL") and os.getenv("EVOLUTION_API_KEY"))


def create_whatsapp_link(user_id: str) -> dict:
    token = secrets.token_urlsafe(32)
    db.telegram_link_tokens.insert_one({
        "token": _hash(token),
        "user_id": user_id,
        "token_type": "whatsapp_link",
        "used": False,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=TOKEN_TTL_MINUTES),
        "created_at": datetime.now(timezone.utc),
    })

    number = _digits(os.getenv("WHATSAPP_BUSINESS_NUMBER"))
    message = f"/start {token}"
    return {
        "token": token,
        "message": message,
        "whatsapp_url": f"https://wa.me/{number}?text={quote(message)}" if number else None,
        "expires_in_minutes": TOKEN_TTL_MINUTES,
    }


def consume_whatsapp_link(token: str, phone: str) -> dict | None:
    row = db.telegram_link_tokens.find_one_and_update(
        {
            "token": _hash(token),
            "token_type": "whatsapp_link",
            "used": False,
            "expires_at": {"$gt": datetime.now(timezone.utc)},
        },
        {"$set": {"used": True}},
        return_document=True,
    )
    if not row:
        return None

    db.profiles.update_one(
        {"_id": row["user_id"]},
        {"$set": {"whatsapp_phone": _digits(phone), "status": "active"}},
    )
    return couple_service.get_profile(row["user_id"])


def get_profile_by_whatsapp(phone: str) -> dict | None:
    doc = db.profiles.find_one({"whatsapp_phone": _digits(phone)})
    return couple_service._ser(doc)


def load_whatsapp_context(phone: str) -> dict | None:
    profile = get_profile_by_whatsapp(phone)
    if not profile:
        return None

    couple = None
    partner = None
    if profile.get("couple_id"):
        couple = couple_service.get_couple(profile["id"])
        if couple and couple.get("is_complete"):
            partner = couple_service.get_partner_profile(profile["id"], couple)

    return {
        "user_id": profile["id"],
        "user_name": profile["name"],
        "couple_id": profile.get("couple_id"),
        "couple_complete": bool(couple and couple.get("is_complete")),
        "partner_id": partner["id"] if partner else None,
        "partner_name": partner["name"] if partner else None,
        "partner_whatsapp_phone": partner.get("whatsapp_phone") if partner else None,
    }


async def send_whatsapp_text(number: str, text: str, instance: str | None = None) -> None:
    if not _reply_enabled() or not _evolution_configured() or not _digits(number):
        return

    base_url = os.getenv("EVOLUTION_API_URL", "").rstrip("/")
    api_key = os.getenv("EVOLUTION_API_KEY", "")
    instance_name = instance or os.getenv("EVOLUTION_INSTANCE_NAME", "fincouple")

    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(
            f"{base_url}/message/sendText/{instance_name}",
            headers={"apikey": api_key, "Content-Type": "application/json"},
            json={"number": _digits(number), "text": text},
        )


async def process_messages_upsert(payload: dict) -> dict:
    if _is_from_me(payload):
        return {"ignored": True, "reason": "from_me"}

    text = _get_text(payload)
    phone = _get_phone(payload)
    instance = _instance(payload)
    if not text or not phone:
        return {"ignored": True, "reason": "empty_text_or_phone"}

    start_match = re.match(r"^/(?:start|vincular)\s+(\S+)$", text.strip(), re.IGNORECASE)
    if start_match:
        profile = consume_whatsapp_link(start_match.group(1), phone)
        if not profile:
            await send_whatsapp_text(phone, "Link invalido ou expirado. Gere um novo link no app.", instance)
            return {"linked": False}
        await send_whatsapp_text(phone, f"WhatsApp vinculado, {profile.get('name', 'cliente')}! Agora pode enviar seus gastos por aqui.", instance)
        return {"linked": True, "user_id": profile["id"]}

    parsed = parse_expense(text)
    if not parsed:
        await send_whatsapp_text(
            phone,
            "Envie um gasto rapido, por exemplo: 'gastei 72 no mercado' ou 'aluguel 2000'.",
            instance,
        )
        return {"processed": False, "reason": "not_parseable"}

    ctx = load_whatsapp_context(phone)
    if not ctx:
        await send_whatsapp_text(phone, "Ainda nao encontrei seu cadastro. Gere o link de WhatsApp no app e me envie o codigo.", instance)
        return {"processed": False, "reason": "unlinked_phone"}

    if not ctx["couple_complete"]:
        await send_whatsapp_text(phone, "Configure seu casal primeiro no app para registrar gastos por WhatsApp.", instance)
        return {"processed": False, "reason": "incomplete_couple"}

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
            source="whatsapp",
            raw_message=text,
        )
        await send_whatsapp_text(phone, f"Receita de R$ {parsed['amount']:.2f} salva!", instance)
        return {"processed": True, "type": "income"}

    expense_service.add_expense(
        couple_id=ctx["couple_id"],
        paid_by_id=ctx["user_id"],
        amount=parsed["amount"],
        category=parsed["category"],
        description=parsed.get("description", ""),
        split_type=parsed.get("split_type", "couple"),
        expense_date=parsed.get("date"),
        source="whatsapp",
    )

    scope_label = "do casal" if parsed.get("split_type") == "couple" else "pessoal"
    await send_whatsapp_text(
        phone,
        f"R$ {parsed['amount']:.2f} em {parsed['category']} salvo como {scope_label}.",
        instance,
    )

    partner_phone = ctx.get("partner_whatsapp_phone")
    if parsed.get("split_type") == "couple" and partner_phone:
        await send_whatsapp_text(
            partner_phone,
            f"{ctx['user_name']} registrou R$ {parsed['amount']:.2f} em {parsed['category']} na carteira do casal.",
            instance,
        )

    return {"processed": True, "type": "expense"}
