from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Literal

from backend.auth import get_current_user
from backend.services import couple_service, ai_assistant_service

router = APIRouter(prefix="/couples/{couple_id}/assistant", tags=["assistant"])


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list)


def _check_couple_access(couple_id: str, user_id: str) -> dict:
    couple = couple_service.get_couple(couple_id)
    if not couple:
        raise HTTPException(404, "Casal nao encontrado")
    if couple.get("user1_id") != user_id and couple.get("user2_id") != user_id:
        raise HTTPException(403, "Sem permissao")
    return couple


@router.post("/chat")
def chat(couple_id: str, data: ChatIn, current_user: dict = Depends(get_current_user)):
    _check_couple_access(couple_id, current_user["id"])
    try:
        return ai_assistant_service.chat(
            couple_id=couple_id,
            current_user_id=current_user["id"],
            user_message=data.message,
            history=[t.model_dump() for t in data.history],
        )
    except ai_assistant_service.OllamaUnavailable as exc:
        raise HTTPException(503, str(exc))


@router.get("/health")
def health(couple_id: str, current_user: dict = Depends(get_current_user)):
    _check_couple_access(couple_id, current_user["id"])
    return ai_assistant_service.health()
