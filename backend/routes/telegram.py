import asyncio
import os

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from telegram import Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    MessageHandler,
    filters,
)

from backend.auth import get_current_user
from backend.bot.main import (
    build_bill_handler,
    build_contrib_handler,
    build_expense_handler,
    build_goal_handler,
    build_login_handler,
    build_onboarding_handler,
    handle_help,
    handle_logout,
    handle_menu_callback,
    handle_nl_message,
    handle_status,
)
from backend.services import telegram_link_service

router = APIRouter(prefix="/telegram", tags=["telegram"])
_telegram_app: Application | None = None
_telegram_app_lock = asyncio.Lock()


class CompleteTelegramProfileIn(BaseModel):
    token: str
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    monthly_income: float = 0.0
    gender: str = "female"


def _check_webhook_secret(secret_token: str | None) -> None:
    expected = os.getenv("TELEGRAM_WEBHOOK_SECRET")
    if expected and secret_token != expected:
        raise HTTPException(status_code=401, detail="Webhook nao autorizado")


async def _get_telegram_app() -> Application:
    global _telegram_app

    if _telegram_app:
        return _telegram_app

    async with _telegram_app_lock:
        if _telegram_app:
            return _telegram_app

        token = os.getenv("BOT_TOKEN")
        if not token:
            raise HTTPException(status_code=500, detail="BOT_TOKEN nao configurado")

        app = Application.builder().token(token).build()
        app.add_handler(build_login_handler())
        app.add_handler(build_onboarding_handler())
        app.add_handler(build_expense_handler())
        app.add_handler(build_bill_handler())
        app.add_handler(build_goal_handler())
        app.add_handler(build_contrib_handler())
        app.add_handler(CommandHandler("logout", handle_logout))
        app.add_handler(CommandHandler("status", handle_status))
        app.add_handler(CommandHandler("help", handle_help))
        app.add_handler(CallbackQueryHandler(handle_menu_callback))
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_nl_message))

        await app.initialize()
        await app.bot.set_my_commands([
            ("start", "Criar conta ou ver menu"),
            ("login", "Entrar com conta do site"),
            ("status", "Ver sua conta e casal"),
            ("logout", "Desvincular conta do Telegram"),
            ("help", "Ajuda e comandos"),
            ("cancel", "Cancelar operacao atual"),
        ])
        await app.start()
        _telegram_app = app
        return app


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


@router.post("/webhook")
async def webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    _check_webhook_secret(x_telegram_bot_api_secret_token)
    payload = await request.json()
    app = await _get_telegram_app()
    update = Update.de_json(payload, app.bot)
    await app.process_update(update)
    return {"ok": True}


@router.get("/webhook-info")
async def webhook_info():
    token = os.getenv("BOT_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="BOT_TOKEN nao configurado")

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(f"https://api.telegram.org/bot{token}/getWebhookInfo")
        response.raise_for_status()
        return response.json()


@router.post("/set-webhook")
async def set_webhook(request: Request):
    token = os.getenv("BOT_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="BOT_TOKEN nao configurado")

    base_url = os.getenv("API_BASE_URL") or os.getenv("FRONTEND_URL") or str(request.base_url)
    if not base_url:
        raise HTTPException(status_code=500, detail="API_BASE_URL nao configurado")

    body = {
        "url": f"{base_url.rstrip('/')}/telegram/webhook",
        "drop_pending_updates": True,
        "allowed_updates": ["message", "callback_query"],
    }
    secret = os.getenv("TELEGRAM_WEBHOOK_SECRET")
    if secret:
        body["secret_token"] = secret

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(f"https://api.telegram.org/bot{token}/setWebhook", json=body)
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail=response.text)
        return response.json()
