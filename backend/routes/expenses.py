from datetime import date
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from backend.auth import get_current_user
from backend.services import expense_service, couple_service

router = APIRouter(prefix="/couples/{couple_id}/expenses", tags=["expenses"])


class ExpenseCreate(BaseModel):
    amount: float = Field(gt=0)
    category: str = "outros"
    description: str = ""
    split_type: str = "couple"
    paid_by_id: Optional[str] = None
    payer_amounts: Optional[dict[str, float]] = None
    date: Optional[date] = None
    source: str = "manual"
    type: str = "expense"


def _check_couple_access(couple_id: str, user_id: str) -> dict:
    couple = couple_service.get_couple(couple_id)
    if not couple:
        raise HTTPException(404, "Casal nao encontrado")
    if couple.get("user1_id") != user_id and couple.get("user2_id") != user_id:
        raise HTTPException(403, "Sem permissao")
    return couple


@router.post("/")
def add_expense(couple_id: str, data: ExpenseCreate, current_user: dict = Depends(get_current_user)):
    _check_couple_access(couple_id, current_user["id"])
    if data.type not in ("income", "expense"):
        raise HTTPException(400, "Tipo invalido")
    if data.split_type == "both" and data.payer_amounts:
        total_paid = sum(data.payer_amounts.values())
        if abs(total_paid - data.amount) > 0.01:
            raise HTTPException(400, "A soma dos valores de cada pessoa deve ser igual ao valor total")
    return expense_service.add_expense(
        couple_id=couple_id,
        paid_by_id=data.paid_by_id or current_user["id"],
        amount=data.amount,
        category=data.category,
        description=data.description,
        split_type=data.split_type,
        expense_date=data.date,
        source=data.source,
        payer_amounts=data.payer_amounts,
        type=data.type,
    )


@router.get("/")
def list_expenses(
    couple_id: str,
    month: int | None = None,
    year: int | None = None,
    current_user: dict = Depends(get_current_user),
):
    _check_couple_access(couple_id, current_user["id"])
    today = date.today()
    return expense_service.get_monthly_expenses(couple_id, month or today.month, year or today.year)


@router.delete("/{expense_id}")
def delete_expense(couple_id: str, expense_id: str, current_user: dict = Depends(get_current_user)):
    _check_couple_access(couple_id, current_user["id"])
    if not expense_service.delete_expense(expense_id, couple_id):
        raise HTTPException(404, "Gasto nao encontrado")
    return {"ok": True}
