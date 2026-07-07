import os

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Request
from pydantic import BaseModel
from backend.auth import get_current_user
from backend import pluggy_client
from backend.services import pluggy_service

router = APIRouter(prefix="/pluggy", tags=["pluggy"])


def _check_webhook_secret(request: Request) -> None:
    expected = os.getenv("PLUGGY_WEBHOOK_SECRET")
    if not expected:
        return
    if request.query_params.get("secret") != expected:
        raise HTTPException(status_code=401, detail="Webhook nao autorizado")


class ItemLink(BaseModel):
    item_id: str


@router.post("/connect-token")
def connect_token(current_user: dict = Depends(get_current_user)):
    try:
        token = pluggy_client.create_connect_token(client_user_id=current_user["id"])
        return {"connectToken": token}
    except Exception as e:
        raise HTTPException(502, f"Erro ao gerar token do Pluggy Connect: {e}")


@router.post("/items")
def create_item(data: ItemLink, current_user: dict = Depends(get_current_user)):
    try:
        return pluggy_service.link_item(current_user["id"], data.item_id)
    except Exception as e:
        raise HTTPException(502, f"Erro ao vincular conta bancaria: {e}")


@router.get("/items")
def list_items(current_user: dict = Depends(get_current_user)):
    return pluggy_service.list_items(current_user["id"])


@router.get("/items/{item_id}/accounts")
def get_accounts(item_id: str, current_user: dict = Depends(get_current_user)):
    return pluggy_service.get_accounts(current_user["id"], item_id)


@router.post("/items/{item_id}/sync")
def sync_item(item_id: str, current_user: dict = Depends(get_current_user)):
    try:
        return pluggy_service.sync_item(current_user["id"], item_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Erro ao sincronizar transacoes: {e}")


@router.delete("/items/{item_id}")
def delete_item(item_id: str, current_user: dict = Depends(get_current_user)):
    if not pluggy_service.unlink_item(current_user["id"], item_id):
        raise HTTPException(404, "Conta bancaria nao encontrada")
    return {"ok": True}


@router.post("/webhook")
async def webhook(request: Request, background_tasks: BackgroundTasks):
    _check_webhook_secret(request)
    event = await request.json()
    # Respond immediately; Pluggy expects an ack within a few seconds.
    background_tasks.add_task(pluggy_service.handle_webhook_event, event)
    return {"received": True}
