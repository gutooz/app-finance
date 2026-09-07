from fastapi import HTTPException, Header
from backend.jwt_auth import decode_token


def _profiles_collection():
    from backend.mongo_client import db

    return db.profiles


def get_current_user(authorization: str = Header(None)) -> dict:
    """FastAPI dependency — validates custom JWT and returns {id, email}."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token nao fornecido")
    token = authorization.removeprefix("Bearer ").strip()
    claims = decode_token(token)
    profile = _profiles_collection().find_one(
        {
            "_id": claims["id"],
            "email": claims.get("email", ""),
            "status": {"$in": ["active", "telegram_only"]},
        },
        {"_id": 1, "email": 1},
    )
    if not profile:
        raise HTTPException(status_code=401, detail="Usuario nao encontrado ou inativo")
    return {"id": profile["_id"], "email": profile.get("email", "")}
