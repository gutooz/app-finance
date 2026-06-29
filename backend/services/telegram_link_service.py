import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from backend.mongo_client import db
from backend.password import hash_password

TOKEN_TTL_MINUTES = 15
COMPLETION_TTL_DAYS = 7


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ── Telegram account linking ─────────────────────────────────

def create_telegram_link(user_id: str) -> dict:
    token = secrets.token_urlsafe(32)
    db.telegram_link_tokens.insert_one({
        "token": _hash(token),
        "user_id": user_id,
        "token_type": "link",
        "used": False,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=TOKEN_TTL_MINUTES),
        "created_at": datetime.now(timezone.utc),
    })
    bot_username = os.getenv("TELEGRAM_BOT_USERNAME") or os.getenv("BOT_USERNAME") or "BotFinanceiro"
    return {
        "token": token,
        "bot_url": f"https://t.me/{bot_username}?start={token}",
        "expires_in_minutes": TOKEN_TTL_MINUTES,
    }


def consume_telegram_link(
    token: str,
    telegram_id: int,
    telegram_username: str | None,
    telegram_first_name: str | None,
) -> dict | None:
    row = db.telegram_link_tokens.find_one_and_update(
        {
            "token": _hash(token),
            "token_type": "link",
            "used": False,
            "expires_at": {"$gt": datetime.now(timezone.utc)},
        },
        {"$set": {"used": True}},
        return_document=True,
    )
    if not row:
        return None
    user_id = row["user_id"]
    db.profiles.update_one(
        {"_id": user_id},
        {"$set": {
            "telegram_id": telegram_id,
            "telegram_username": telegram_username,
            "telegram_first_name": telegram_first_name,
            "status": "active",
        }},
    )
    profile = db.profiles.find_one({"_id": user_id})
    if not profile:
        return None
    profile["id"] = profile.pop("_id")
    profile.pop("password_hash", None)
    return profile


# ── Profile completion from Telegram ────────────────────────

def create_profile_completion_link(user_id: str) -> dict:
    token = secrets.token_urlsafe(32)
    db.telegram_link_tokens.insert_one({
        "token": _hash(token),
        "user_id": user_id,
        "token_type": "profile_completion",
        "used": False,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=COMPLETION_TTL_DAYS),
        "created_at": datetime.now(timezone.utc),
    })
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return {
        "token": token,
        "url": f"{frontend_url}/complete-profile?token={token}",
        "expires_in_days": COMPLETION_TTL_DAYS,
    }


def _get_valid_completion_token(token: str) -> dict | None:
    return db.telegram_link_tokens.find_one({
        "token": _hash(token),
        "token_type": "profile_completion",
        "used": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)},
    })


def get_completion_profile(token: str) -> dict | None:
    row = _get_valid_completion_token(token)
    if not row:
        return None
    profile = db.profiles.find_one(
        {"_id": row["user_id"]},
        {"_id": 1, "name": 1, "monthly_income": 1, "gender": 1, "telegram_id": 1, "status": 1},
    )
    if not profile:
        return None
    profile["id"] = profile.pop("_id")
    return profile


def complete_telegram_profile(
    token: str,
    email: str,
    password: str,
    name: str,
    monthly_income: float,
    gender: str = "female",
) -> dict:
    row = _get_valid_completion_token(token)
    if not row:
        raise ValueError("Link invalido ou expirado")
    user_id = row["user_id"]

    # Check email uniqueness
    if db.profiles.find_one({"email": email, "_id": {"$ne": user_id}}):
        raise ValueError("Email ja em uso")

    db.profiles.update_one(
        {"_id": user_id},
        {"$set": {
            "email": email,
            "password_hash": hash_password(password),
            "name": name,
            "monthly_income": float(monthly_income),
            "gender": gender if gender in ("male", "female") else "female",
            "status": "active",
        }},
    )
    db.telegram_link_tokens.update_one({"_id": row["_id"]}, {"$set": {"used": True}})
    profile = db.profiles.find_one({"_id": user_id})
    if profile:
        profile["id"] = profile.pop("_id")
        profile.pop("password_hash", None)
    return profile or {}
