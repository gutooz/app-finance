from datetime import date
from fastapi import APIRouter, HTTPException, Depends
from backend.auth import get_current_user
from backend.services import summary_service, couple_service

router = APIRouter(prefix="/couples/{couple_id}/summary", tags=["summary"])


@router.get("/")
def get_summary(
    couple_id: str,
    month: int | None = None,
    year: int | None = None,
    current_user: dict = Depends(get_current_user),
):
    couple = couple_service.get_couple(couple_id)
    if not couple:
        raise HTTPException(404, "Casal nao encontrado")
    if couple.get("user1_id") != current_user["id"] and couple.get("user2_id") != current_user["id"]:
        raise HTTPException(403, "Sem permissao")
    today = date.today()
    data = summary_service.get_monthly_summary(couple_id, month or today.month, year or today.year)
    if not data:
        raise HTTPException(404, "Casal nao encontrado")
    return data
