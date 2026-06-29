import os

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from backend.auth import get_current_user
from backend.services import whatsapp_service

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


def _check_webhook_secret(authorization: str | None) -> None:
    expected = os.getenv("WHATSAPP_WEBHOOK_SECRET")
    if not expected:
        return
    if authorization != expected and authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Webhook nao autorizado")


@router.post("/link-token")
def create_link_token(current_user: dict = Depends(get_current_user)):
    return whatsapp_service.create_whatsapp_link(current_user["id"])


@router.post("/webhook")
async def webhook(request: Request, authorization: str | None = Header(default=None)):
    _check_webhook_secret(authorization)
    payload = await request.json()
    return await whatsapp_service.process_messages_upsert(payload)


@router.post("/webhook/messages-upsert")
async def messages_upsert(request: Request, authorization: str | None = Header(default=None)):
    _check_webhook_secret(authorization)
    payload = await request.json()
    return await whatsapp_service.process_messages_upsert(payload)
