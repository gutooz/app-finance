from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.services import couple_service

router = APIRouter(prefix="/couples", tags=["couples"])


class CoupleCreate(BaseModel):
    split_mode: str = "50_50"


class CoupleJoin(BaseModel):
    invite_token: str
    split_mode: str = "50_50"


@router.post("/")
def create_couple(data: CoupleCreate, current_user: dict = Depends(get_current_user)):
    profile = couple_service.get_profile(current_user["id"])
    if profile and profile.get("couple_id"):
        raise HTTPException(400, "Voce ja pertence a um casal")
    return couple_service.create_couple(current_user["id"], data.split_mode)


@router.post("/join")
def join_couple(data: CoupleJoin, current_user: dict = Depends(get_current_user)):
    couple = couple_service.get_couple_by_token(data.invite_token.strip())
    if not couple:
        raise HTTPException(404, "Codigo de convite invalido")
    if couple.get("is_complete"):
        raise HTTPException(400, "Este casal ja esta completo")
    if couple.get("user1_id") == current_user["id"]:
        raise HTTPException(400, "Voce nao pode entrar no proprio casal")
    return couple_service.join_couple(couple["id"], current_user["id"], data.split_mode)


@router.get("/me")
def get_my_couple(current_user: dict = Depends(get_current_user)):
    profile = couple_service.get_profile(current_user["id"])
    if not profile or not profile.get("couple_id"):
        raise HTTPException(404, "Voce nao pertence a um casal ainda")
    couple = couple_service.get_couple(str(profile["couple_id"]))
    if not couple:
        raise HTTPException(404, "Casal nao encontrado")
    return couple


@router.get("/{couple_id}")
def get_couple(couple_id: str, current_user: dict = Depends(get_current_user)):
    couple = couple_service.get_couple(couple_id)
    if not couple:
        raise HTTPException(404, "Casal nao encontrado")
    if couple.get("user1_id") != current_user["id"] and couple.get("user2_id") != current_user["id"]:
        raise HTTPException(403, "Sem permissao")
    return couple
