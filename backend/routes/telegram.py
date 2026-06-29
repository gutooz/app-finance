from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from backend.auth import get_current_user
from backend.services import telegram_link_service

router = APIRouter(prefix="/telegram", tags=["telegram"])


class CompleteTelegramProfileIn(BaseModel):
    token: str
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    monthly_income: float = 0.0
    gender: str = "female"


@router.post("/link-token")
def create_link_token(current_user: dict = Depends(get_current_user)):
    return telegram_link_service.create_telegram_link(current_user["id"])


@router.get("/complete-profile")
def get_completion_profile(token: str):
    profile = telegram_link_service.get_completion_profile(token)
    if not profile:
        raise HTTPException(404, "Link invalido ou expirado")
    return profile


@router.post("/complete-profile")
def complete_profile(data: CompleteTelegramProfileIn):
    try:
        return telegram_link_service.complete_telegram_profile(
            token=data.token,
            email=data.email,
            password=data.password,
            name=data.name,
            monthly_income=data.monthly_income,
            gender=data.gender,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(400, f"Erro ao completar perfil: {exc}") from exc
