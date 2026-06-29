from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, date as date_type
import secrets
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=True)
    name = Column(String(100), nullable=False)
    monthly_income = Column(Float, default=0.0)
    couple_id = Column(Integer, ForeignKey("couples.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    expenses_paid = relationship("Expense", back_populates="paid_by")
    contributions = relationship("GoalContribution", back_populates="user")
    bill_payments = relationship("BillPayment", back_populates="paid_by")


class Couple(Base):
    __tablename__ = "couples"

    id = Column(Integer, primary_key=True)
    user1_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user2_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    split_mode = Column(String(20), default="50_50")
    invite_token = Column(String(50), unique=True, default=lambda: secrets.token_urlsafe(8))
    is_complete = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])
    expenses = relationship("Expense", back_populates="couple", cascade="all, delete-orphan")
    bills = relationship("FixedBill", back_populates="couple", cascade="all, delete-orphan")
    goals = relationship("Goal", back_populates="couple", cascade="all, delete-orphan")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True)
    couple_id = Column(Integer, ForeignKey("couples.id"), nullable=False)
    paid_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String(50), default="outros")
    description = Column(String(200), nullable=True)
    # couple | mine | partners
    split_type = Column(String(20), default="couple")
    date = Column(Date, default=date_type.today)
    created_at = Column(DateTime, default=datetime.utcnow)

    couple = relationship("Couple", back_populates="expenses")
    paid_by = relationship("User", back_populates="expenses_paid")


class FixedBill(Base):
    __tablename__ = "fixed_bills"

    id = Column(Integer, primary_key=True)
    couple_id = Column(Integer, ForeignKey("couples.id"), nullable=False)
    name = Column(String(100), nullable=False)
    amount = Column(Float, nullable=False)
    due_day = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    couple = relationship("Couple", back_populates="bills")
    payments = relationship("BillPayment", back_populates="bill", cascade="all, delete-orphan")


class BillPayment(Base):
    __tablename__ = "bill_payments"

    id = Column(Integer, primary_key=True)
    bill_id = Column(Integer, ForeignKey("fixed_bills.id"), nullable=False)
    paid_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    paid_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("FixedBill", back_populates="payments")
    paid_by = relationship("User", back_populates="bill_payments")


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True)
    couple_id = Column(Integer, ForeignKey("couples.id"), nullable=False)
    name = Column(String(100), nullable=False)
    emoji = Column(String(10), default="")
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0.0)
    deadline = Column(Date, nullable=True)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    couple = relationship("Couple", back_populates="goals")
    contributions = relationship("GoalContribution", back_populates="goal", cascade="all, delete-orphan")


class GoalContribution(Base):
    __tablename__ = "goal_contributions"

    id = Column(Integer, primary_key=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    note = Column(String(200), nullable=True)
    date = Column(Date, default=date_type.today)
    created_at = Column(DateTime, default=datetime.utcnow)

    goal = relationship("Goal", back_populates="contributions")
    user = relationship("User", back_populates="contributions")
