import argparse
from datetime import datetime, timezone

from dotenv import load_dotenv

from backend.mongo_client import db


APP_COLLECTIONS = [
    "profiles",
    "couples",
    "expenses",
    "fixed_bills",
    "goals",
    "categories",
    "pluggy_items",
    "telegram_link_tokens",
    "password_reset_tokens",
    "transactions",
]


def _counts() -> dict[str, int]:
    return {name: db[name].count_documents({}) for name in APP_COLLECTIONS}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apaga usuarios e dados pessoais/financeiros do banco couple_finance."
    )
    parser.add_argument("--execute", action="store_true", help="Executa a limpeza. Sem isso, mostra apenas a previa.")
    parser.add_argument("--confirm", default="", help="Use APAGAR_TODOS_USUARIOS para liberar a execucao.")
    args = parser.parse_args()

    before = _counts()
    print("Antes:")
    for name, count in before.items():
        print(f"  {name}: {count}")

    if not args.execute:
        print("Previa concluida. Nada foi apagado.")
        return

    if args.confirm != "APAGAR_TODOS_USUARIOS":
        raise SystemExit("Confirmacao invalida. Nada foi apagado.")

    deleted: dict[str, int] = {}
    for name in APP_COLLECTIONS:
        deleted[name] = db[name].delete_many({}).deleted_count

    db.maintenance_audit.insert_one(
        {
            "operation": "purge_all_users",
            "deleted_counts": deleted,
            "created_at": datetime.now(timezone.utc),
        }
    )

    print("Apagado:")
    for name, count in deleted.items():
        print(f"  {name}: {count}")
    print("Depois:")
    for name, count in _counts().items():
        print(f"  {name}: {count}")


if __name__ == "__main__":
    load_dotenv()
    main()
