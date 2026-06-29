import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "")
if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI e obrigatorio no .env")

_client = MongoClient(MONGODB_URI)
db = _client["couple_finance"]
