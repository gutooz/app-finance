import bcrypt as _bcrypt

MAX_PASSWORD_BYTES = 72


def hash_password(plain: str) -> str:
    encoded = plain.encode()
    if len(encoded) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Senha muito longa (maximo {MAX_PASSWORD_BYTES} bytes)")
    return _bcrypt.hashpw(encoded, _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False
