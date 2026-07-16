import calendar
from datetime import datetime
from bson import ObjectId
from backend.mongo_client import db
from backend.services.couple_service import get_couple, calculate_split


def get_monthly_summary(couple_id: str, month: int, year: int) -> dict:
    couple = get_couple(couple_id)
    if not couple:
        return {}

    user1 = couple.get("user1") or {}
    user2 = couple.get("user2") or {}
    inc1 = float(user1.get("monthly_income") or 0)
    inc2 = float(user2.get("monthly_income") or 0)
    user1_id = couple.get("user1_id")
    split_mode = couple.get("split_mode", "50_50")

    last_day = calendar.monthrange(year, month)[1]
    start = datetime(year, month, 1)
    end = datetime(year, month, last_day, 23, 59, 59)

    expenses = list(db.expenses.find({
        "couple_id": ObjectId(couple_id),
        "date": {"$gte": start, "$lte": end},
        "type": {"$ne": "income"},
    }))

    income_total = sum(float(i["amount"]) for i in db.expenses.find({
        "couple_id": ObjectId(couple_id),
        "date": {"$gte": start, "$lte": end},
        "type": "income",
    }))

    total = 0.0
    by_category: dict[str, float] = {}
    user1_paid = 0.0
    user2_paid = 0.0
    balance = 0.0  # positive = user2 owes user1

    user2_id = couple.get("user2_id")

    for e in expenses:
        amount = float(e["amount"])
        total += amount
        cat = e.get("category", "outros")
        by_category[cat] = by_category.get(cat, 0) + amount
        payer_is_1 = e["paid_by_id"] == user1_id

        if e["split_type"] == "both":
            payer_amounts = e.get("payer_amounts") or {}
            amt1 = float(payer_amounts.get(user1_id, 0))
            amt2 = float(payer_amounts.get(user2_id, 0))
            user1_paid += amt1
            user2_paid += amt2
            s1, _s2 = calculate_split(amount, split_mode, inc1, inc2)
            balance += amt1 - s1
        elif e["split_type"] == "couple":
            s1, s2 = calculate_split(amount, split_mode, inc1, inc2)
            if payer_is_1:
                user1_paid += amount
                balance += s2
            else:
                user2_paid += amount
                balance -= s1
        elif e["split_type"] == "mine":
            if payer_is_1:
                user1_paid += amount
            else:
                user2_paid += amount
        elif e["split_type"] == "partners":
            if payer_is_1:
                user1_paid += amount
                balance += amount
            else:
                user2_paid += amount
                balance -= amount

    bills = list(db.fixed_bills.find({
        "couple_id": ObjectId(couple_id),
        "is_active": True,
    }))
    bills_total = sum(float(b["amount"]) for b in bills)
    bills_paid = 0.0
    for bill in bills:
        payments = bill.get("payments", [])
        if any(p["month"] == month and p["year"] == year for p in payments):
            bills_paid += float(bill["amount"])

    goals = list(db.goals.find({
        "couple_id": ObjectId(couple_id),
        "is_completed": False,
    }))

    u1_name = user1.get("name", "Pessoa 1")
    u2_name = user2.get("name", "Pessoa 2")

    if balance > 0.01:
        balance_desc = f"{u2_name} deve R$ {balance:.2f} para {u1_name}"
    elif balance < -0.01:
        balance_desc = f"{u1_name} deve R$ {abs(balance):.2f} para {u2_name}"
    else:
        balance_desc = "Voces estao quites!"

    return {
        "month": month,
        "year": year,
        "total_expenses": total,
        "total_income": income_total,
        "by_category": dict(sorted(by_category.items(), key=lambda x: x[1], reverse=True)),
        "user1_name": u1_name,
        "user2_name": u2_name,
        "user1_paid": user1_paid,
        "user2_paid": user2_paid,
        "balance": balance,
        "balance_description": balance_desc,
        "bills_total": bills_total,
        "bills_paid": bills_paid,
        "bills_pending": bills_total - bills_paid,
        "goals": [
            {
                "name": g["name"],
                "emoji": g.get("emoji", ""),
                "current": float(g["current_amount"]),
                "target": float(g["target_amount"]),
                "percent": min(100, int(
                    (float(g["current_amount"]) / float(g["target_amount"])) * 100
                )) if float(g["target_amount"]) > 0 else 0,
            }
            for g in goals
        ],
    }
