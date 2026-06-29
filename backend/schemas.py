from pydantic import BaseModel, Field
from datetime import date
from typing import Optional


# --- User ---
class UserCreate(BaseModel):
    name: str
    monthly_income: float = 0.0
    gender: str = "female"
    telegram_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    name: str
    monthly_income: float
    gender: str = "female"
    couple_id: Optional[int]

    model_config = {"from_attributes": True}


# --- Couple ---
class CoupleCreate(BaseModel):
    user1_name: str
    user1_income: float
    split_mode: str = "50_50"


class CoupleJoin(BaseModel):
    invite_token: str
    user2_name: str
    user2_income: float
    split_mode: str = "50_50"


class CoupleOut(BaseModel):
    id: int
    split_mode: str
    invite_token: str
    is_complete: bool
    user1: UserOut
    user2: Optional[UserOut]

    model_config = {"from_attributes": True}


# --- Expense ---
class ExpenseCreate(BaseModel):
    paid_by_id: int
    amount: float = Field(gt=0)
    category: str = "outros"
    description: str = ""
    split_type: str = "couple"
    date: Optional[date] = None


class ExpenseOut(BaseModel):
    id: int
    amount: float
    category: str
    description: Optional[str]
    split_type: str
    date: date
    paid_by: UserOut

    model_config = {"from_attributes": True}


# --- Fixed Bill ---
class BillCreate(BaseModel):
    name: str
    amount: float = Field(gt=0)
    due_day: int = Field(ge=1, le=31)


class BillOut(BaseModel):
    id: int
    name: str
    amount: float
    due_day: int
    is_paid: bool = False  # computed per month

    model_config = {"from_attributes": True}


# --- Goal ---
class GoalCreate(BaseModel):
    name: str
    emoji: str = ""
    target_amount: float = Field(gt=0)
    deadline: Optional[date] = None


class GoalContribCreate(BaseModel):
    user_id: int
    amount: float = Field(gt=0)
    note: str = ""


class GoalOut(BaseModel):
    id: int
    name: str
    emoji: str
    target_amount: float
    current_amount: float
    deadline: Optional[date]
    is_completed: bool

    model_config = {"from_attributes": True}


# --- Summary ---
class MonthlySummary(BaseModel):
    month: int
    year: int
    total_expenses: float
    by_category: dict[str, float]
    user1_name: str
    user2_name: str
    user1_paid: float
    user2_paid: float
    balance: float
    balance_description: str
    bills_total: float
    bills_paid: float
    bills_pending: float
    goals: list[dict]
