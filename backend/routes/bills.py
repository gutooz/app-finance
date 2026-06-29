from datetime import date
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from backend.auth import get_current_user
from backend.services import bill_service, couple_service

router = APIRouter(prefix="/couples/{couple_id}/bills", tags=["bills"])


class BillCreate(BaseModel):
    name: str
    amount: float = Field(gt=0)
    due_day: int = Field(ge=1, le=31)


def _check_access(couple_id: str, user_id: str) -> dict:
    couple = couple_service.get_couple(couple_id)
    if not couple:
        raise HTTPException(404, "Casal nao encontrado")
    if couple.get("user1_id") != user_id and couple.get("user2_id") != user_id:
        raise HTTPException(403, "Sem permissao")
    return couple


@router.post("/")
def add_bill(couple_id: str, data: BillCreate, current_user: dict = Depends(get_current_user)):
    _check_access(couple_id, current_user["id"])
    bill = bill_service.add_bill(couple_id, data.name, data.amount, data.due_day)
    return {**bill, "is_paid": False}


@router.get("/")
def list_bills(
    couple_id: str,
    month: int | None = None,
    year: int | None = None,
    current_user: dict = Depends(get_current_user),
):
    _check_access(couple_id, current_user["id"])
    today = date.today()
    m, y = month or today.month, year or today.year
    return bill_service.get_couple_bills(couple_id, m, y)


@router.post("/{bill_id}/pay")
def toggle_bill(
    couple_id: str,
    bill_id: str,
    month: int | None = None,
    year: int | None = None,
    current_user: dict = Depends(get_current_user),
):
    _check_access(couple_id, current_user["id"])
    today = date.today()
    m, y = month or today.month, year or today.year
    existing = bill_service.get_bill_payment(bill_id, m, y)
    if existing:
        bill_service.unmark_bill_paid(bill_id, m, y)
        return {"paid": False}
    bill_service.mark_bill_paid(bill_id, current_user["id"], m, y)
    return {"paid": True}


@router.delete("/{bill_id}")
def delete_bill(couple_id: str, bill_id: str, current_user: dict = Depends(get_current_user)):
    _check_access(couple_id, current_user["id"])
    if not bill_service.deactivate_bill(bill_id, couple_id):
        raise HTTPException(404, "Conta nao encontrada")
    return {"ok": True}
