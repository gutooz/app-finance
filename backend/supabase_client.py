# Supabase foi removido. Auth agora usa JWT proprio (backend/jwt_auth.py)
# e dados ficam no MongoDB Atlas (backend/mongo_client.py).
raise ImportError(
    "supabase_client.py foi removido. "
    "Use backend.jwt_auth para auth e backend.mongo_client para dados."
)
