import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr

from backend.mongo_client import db
from backend.jwt_auth import create_access_token
from backend.auth import get_current_user
from backend.password import hash_password, verify_password
from backend.services import couple_service

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    monthly_income: float = 0.0
    gender: str = "female"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    name: str
    monthly_income: float = 0.0
    gender: str = "female"


class EmailUpdate(BaseModel):
    email: EmailStr


class PasswordUpdate(BaseModel):
    password: str


def _clean_profile(doc: dict) -> dict:
    from bson import ObjectId
    out = dict(doc)
    out["id"] = out.pop("_id")
    out.pop("password_hash", None)
    if out.get("couple_id") and isinstance(out["couple_id"], ObjectId):
        out["couple_id"] = str(out["couple_id"])
    return out


@router.post("/register")
def register(data: RegisterIn):
    email = data.email.lower()
    if db.profiles.find_one({"email": email}):
        raise HTTPException(400, "Email ja cadastrado")
    try:
        password_hash = hash_password(data.password)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    user_id = str(uuid.uuid4())
    normalized_gender = data.gender if data.gender in ("male", "female") else "female"
    db.profiles.insert_one({
        "_id": user_id,
        "email": email,
        "password_hash": password_hash,
        "name": data.name,
        "monthly_income": float(data.monthly_income),
        "gender": normalized_gender,
        "couple_id": None,
        "status": "active",
        "created_at": datetime.utcnow(),
    })
    token = create_access_token(user_id, email)
    return {
        "user": {"id": user_id, "email": email},
        "session": {"access_token": token},
    }


@router.post("/login")
def login(data: LoginIn):
    user = db.profiles.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(401, "Email ou senha incorretos")
    token = create_access_token(user["_id"], user["email"])
    profile = _clean_profile(user)
    couple = None
    if profile.get("couple_id"):
        couple = couple_service.get_couple(str(profile["couple_id"]))
    return {
        "user": {"id": profile["id"], "email": profile["email"]},
        "profile": profile,
        "couple": couple,
        "session": {"access_token": token},
    }


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    profile = couple_service.get_profile(current_user["id"])
    couple = None
    if profile and profile.get("couple_id"):
        couple = couple_service.get_couple(str(profile["couple_id"]))
    return {"user": current_user, "profile": profile, "couple": couple}


@router.put("/profile")
def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    return couple_service.upsert_profile(
        current_user["id"], data.name, data.monthly_income, gender=data.gender
    )


@router.put("/email")
def update_email(data: EmailUpdate, current_user: dict = Depends(get_current_user)):
    email = data.email.lower()
    if db.profiles.find_one({"email": email, "_id": {"$ne": current_user["id"]}}):
        raise HTTPException(400, "Email ja em uso")
    db.profiles.update_one({"_id": current_user["id"]}, {"$set": {"email": email}})
    return {"ok": True}


@router.put("/password")
def update_password(data: PasswordUpdate, current_user: dict = Depends(get_current_user)):
    if len(data.password) < 6:
        raise HTTPException(400, "Senha deve ter ao menos 6 caracteres")
    try:
        password_hash = hash_password(data.password)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    db.profiles.update_one(
        {"_id": current_user["id"]},
        {"$set": {"password_hash": password_hash}},
    )
    return {"ok": True}
