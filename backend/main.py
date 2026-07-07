from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from backend.routes import auth, couples, expenses, bills, goals, summary, telegram, whatsapp, admin, pluggy

app = FastAPI(title="FinCouple API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(couples.router)
app.include_router(expenses.router)
app.include_router(bills.router)
app.include_router(goals.router)
app.include_router(summary.router)
app.include_router(telegram.router)
app.include_router(whatsapp.router)
app.include_router(admin.router)
app.include_router(pluggy.router)


@app.get("/")
def root():
    return {"message": "FinCouple API v2 — MongoDB Atlas", "docs": "/docs"}
