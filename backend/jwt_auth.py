import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi import HTTPException

SECRET_KEY = os.getenv("JWT_SECRET", "fincouple-change-this-in-prod")
ALGORITHM = "HS256"
EXPIRE_DAYS = 30


def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=EXPIRE_DAYS)
    return jwt.encode(
        {"sub": user_id, "email": email, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Token invalido")
        return {"id": user_id, "email": payload.get("email", "")}
    except JWTError:
        raise HTTPException(401, "Token invalido ou expirado")
