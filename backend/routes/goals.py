from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from datetime import date
from typing import Optional
from backend.auth import get_current_user
from backend.services import goal_service, couple_service

router = APIRouter(prefix="/couples/{couple_id}/goals", tags=["goals"])


class GoalCreate(BaseModel):
    name: str
    emoji: str = ""
    target_amount: float = Field(gt=0)
    deadline: Optional[date] = None


class ContribCreate(BaseModel):
    amount: float = Field(gt=0)
    note: str = ""
    user_id: Optional[str] = None


def _check_access(couple_id: str, user_id: str) -> dict:
    couple = couple_service.get_couple(couple_id)
    if not couple:
        raise HTTPException(404, "Casal nao encontrado")
    if couple.get("user1_id") != user_id and couple.get("user2_id") != user_id:
        raise HTTPException(403, "Sem permissao")
    return couple


@router.post("/")
def create_goal(couple_id: str, data: GoalCreate, current_user: dict = Depends(get_current_user)):
    _check_access(couple_id, current_user["id"])
    return goal_service.create_goal(couple_id, data.name, data.target_amount, data.emoji, data.deadline)


@router.get("/")
def list_goals(couple_id: str, current_user: dict = Depends(get_current_user)):
    _check_access(couple_id, current_user["id"])
    return goal_service.get_couple_goals(couple_id)


@router.post("/{goal_id}/contribute")
def contribute(
    couple_id: str,
    goal_id: str,
    data: ContribCreate,
    current_user: dict = Depends(get_current_user),
):
    _check_access(couple_id, current_user["id"])
    result = goal_service.add_contribution(goal_id, data.user_id or current_user["id"], data.amount, data.note)
    if not result:
        raise HTTPException(404, "Meta nao encontrada")
    return result


@router.delete("/{goal_id}")
def delete_goal(couple_id: str, goal_id: str, current_user: dict = Depends(get_current_user)):
    _check_access(couple_id, current_user["id"])
    if not goal_service.delete_goal(goal_id, couple_id):
        raise HTTPException(404, "Meta nao encontrada")
    return {"ok": True}
