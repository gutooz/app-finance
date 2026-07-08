from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from backend.auth import get_current_user
from backend.services import category_service, couple_service

router = APIRouter(prefix="/couples/{couple_id}/categories", tags=["categories"])


class CategoryCreate(BaseModel):
    name: str
    emoji: str = "📦"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None


def _check_access(couple_id: str, user_id: str) -> dict:
    couple = couple_service.get_couple(couple_id)
    if not couple:
        raise HTTPException(404, "Casal nao encontrado")
    if couple.get("user1_id") != user_id and couple.get("user2_id") != user_id:
        raise HTTPException(403, "Sem permissao")
    return couple


@router.get("/")
def list_categories(couple_id: str, current_user: dict = Depends(get_current_user)):
    _check_access(couple_id, current_user["id"])
    return category_service.get_couple_categories(couple_id)


@router.post("/")
def create_category(couple_id: str, data: CategoryCreate, current_user: dict = Depends(get_current_user)):
    _check_access(couple_id, current_user["id"])
    if not data.name.strip():
        raise HTTPException(400, "Nome obrigatorio")
    return category_service.create_category(couple_id, data.name, data.emoji)


@router.put("/{category_id}")
def update_category(
    couple_id: str, category_id: str, data: CategoryUpdate, current_user: dict = Depends(get_current_user)
):
    _check_access(couple_id, current_user["id"])
    result = category_service.update_category(category_id, couple_id, data.name, data.emoji)
    if not result:
        raise HTTPException(404, "Categoria nao encontrada")
    return result


@router.delete("/{category_id}")
def delete_category(couple_id: str, category_id: str, current_user: dict = Depends(get_current_user)):
    _check_access(couple_id, current_user["id"])
    if not category_service.delete_category(category_id, couple_id):
        raise HTTPException(404, "Categoria nao encontrada")
    return {"ok": True}
