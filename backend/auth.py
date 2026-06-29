from fastapi import HTTPException, Header
from backend.jwt_auth import decode_token


def get_current_user(authorization: str = Header(None)) -> dict:
    """FastAPI dependency — validates custom JWT and returns {id, email}."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token nao fornecido")
    token = authorization.removeprefix("Bearer ").strip()
    return decode_token(token)
