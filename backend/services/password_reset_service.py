import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from backend.mongo_client import db
from backend.password import hash_password
from backend.services.email_service import send_password_reset_email

TOKEN_TTL_MINUTES = 30


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def request_password_reset(email: str) -> None:
    """Sends a reset email if the address is registered. Never reveals whether it exists."""
    email = email.strip().lower()
    profile = db.profiles.find_one({"email": email})
    if not profile:
        return

    token = secrets.token_urlsafe(32)
    db.password_reset_tokens.insert_one({
        "token": _hash(token),
        "user_id": profile["_id"],
        "used": False,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=TOKEN_TTL_MINUTES),
        "created_at": datetime.now(timezone.utc),
    })

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    reset_url = f"{frontend_url}/redefinir-senha?token={token}"
    send_password_reset_email(email, reset_url, TOKEN_TTL_MINUTES)


def reset_password(token: str, new_password: str) -> None:
    row = db.password_reset_tokens.find_one_and_update(
        {
            "token": _hash(token),
            "used": False,
            "expires_at": {"$gt": datetime.now(timezone.utc)},
        },
        {"$set": {"used": True}},
        return_document=True,
    )
    if not row:
        raise ValueError("Link invalido ou expirado")

    db.profiles.update_one(
        {"_id": row["user_id"]},
        {"$set": {"password_hash": hash_password(new_password)}},
    )
