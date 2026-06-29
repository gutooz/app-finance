from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from backend.auth import get_current_user
from backend.mongo_client import db

ADMIN_EMAILS = {"gustavosantiago2912@gmail.com", "snyderisabellaalves@gmail.com"}

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("email") not in ADMIN_EMAILS:
        raise HTTPException(403, "Acesso restrito a administradores")
    return current_user


@router.get("/stats")
def get_stats(_: dict = Depends(require_admin)):
    # ── Usuários ──────────────────────────────────────────────────────────────
    total_users = db.profiles.count_documents({})

    gender_agg = list(db.profiles.aggregate([
        {"$group": {"_id": "$gender", "count": {"$sum": 1}}}
    ]))
    gender_map = {g["_id"]: g["count"] for g in gender_agg}
    male_count = gender_map.get("male", 0)
    female_count = gender_map.get("female", 0)

    income_agg = list(db.profiles.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$monthly_income"}, "avg": {"$avg": "$monthly_income"}}}
    ]))
    total_income = income_agg[0]["total"] if income_agg else 0
    avg_income = income_agg[0]["avg"] if income_agg else 0

    # ── Casais ────────────────────────────────────────────────────────────────
    total_couples = db.couples.count_documents({})
    active_couples = db.couples.count_documents({"is_complete": True})

    # ── Gastos ────────────────────────────────────────────────────────────────
    total_expenses = db.expenses.count_documents({})

    exp_amount_agg = list(db.expenses.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]))
    total_expense_amount = exp_amount_agg[0]["total"] if exp_amount_agg else 0

    # ── Horários de pico (por hora do dia nos gastos) ─────────────────────────
    hour_agg = list(db.expenses.aggregate([
        {"$match": {"created_at": {"$exists": True}}},
        {"$addFields": {"hour": {"$hour": {"date": "$created_at", "timezone": "America/Sao_Paulo"}}}},
        {"$group": {"_id": "$hour", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]))
    # Fill all 24 hours with 0 if missing
    hour_map = {h["_id"]: h["count"] for h in hour_agg}
    peak_hours = [{"hour": h, "count": hour_map.get(h, 0)} for h in range(24)]

    # ── Categorias mais usadas ────────────────────────────────────────────────
    cat_agg = list(db.expenses.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}, "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
        {"$limit": 8},
    ]))
    categories = [
        {"name": c["_id"] or "outros", "count": c["count"], "total": round(c["total"], 2)}
        for c in cat_agg
    ]

    # ── Crescimento mensal (novos usuários por mês) ───────────────────────────
    monthly_agg = list(db.profiles.aggregate([
        {"$match": {"created_at": {"$exists": True}}},
        {"$addFields": {
            "month": {"$month": "$created_at"},
            "year": {"$year": "$created_at"},
        }},
        {"$group": {"_id": {"year": "$year", "month": "$month"}, "count": {"$sum": 1}}},
        {"$sort": {"_id.year": 1, "_id.month": 1}},
        {"$limit": 12},
    ]))
    monthly_growth = [
        {
            "label": f"{m['_id']['year']}-{m['_id']['month']:02d}",
            "count": m["count"],
        }
        for m in monthly_agg
    ]

    # ── Últimos usuários cadastrados ──────────────────────────────────────────
    recent_docs = list(db.profiles.find(
        {},
        {"_id": 1, "name": 1, "email": 1, "gender": 1, "created_at": 1, "couple_id": 1},
    ).sort("created_at", -1).limit(10))
    recent_users = []
    for u in recent_docs:
        recent_users.append({
            "id": str(u["_id"]),
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "gender": u.get("gender", ""),
            "has_couple": bool(u.get("couple_id")),
            "created_at": u["created_at"].isoformat() if isinstance(u.get("created_at"), datetime) else "",
        })

    # ── Telegram vinculado ────────────────────────────────────────────────────
    telegram_linked = db.profiles.count_documents({"telegram_id": {"$exists": True, "$ne": None}})

    return {
        "users": {
            "total": total_users,
            "male": male_count,
            "female": female_count,
            "telegram_linked": telegram_linked,
            "total_monthly_income": round(total_income, 2),
            "avg_monthly_income": round(avg_income, 2),
        },
        "couples": {
            "total": total_couples,
            "active": active_couples,
            "pending": total_couples - active_couples,
        },
        "expenses": {
            "total_transactions": total_expenses,
            "total_amount": round(total_expense_amount, 2),
        },
        "peak_hours": peak_hours,
        "categories": categories,
        "monthly_growth": monthly_growth,
        "recent_users": recent_users,
    }
