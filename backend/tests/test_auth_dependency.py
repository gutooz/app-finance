import pytest
from fastapi import HTTPException

from backend import auth


class _Profiles:
    def __init__(self, result):
        self.result = result
        self.query = None

    def find_one(self, query, projection=None):
        self.query = query
        return self.result


def test_get_current_user_requires_existing_active_profile(monkeypatch):
    profiles = _Profiles({"_id": "user-1", "email": "user@example.com"})
    monkeypatch.setattr(auth, "_profiles_collection", lambda: profiles)
    monkeypatch.setattr(
        auth,
        "decode_token",
        lambda token: {"id": "user-1", "email": "user@example.com"},
    )

    assert auth.get_current_user("Bearer valid-token") == {
        "id": "user-1",
        "email": "user@example.com",
    }
    assert profiles.query == {
        "_id": "user-1",
        "email": "user@example.com",
        "status": {"$in": ["active", "telegram_only"]},
    }


def test_get_current_user_rejects_deleted_profile(monkeypatch):
    monkeypatch.setattr(auth, "_profiles_collection", lambda: _Profiles(None))
    monkeypatch.setattr(
        auth,
        "decode_token",
        lambda token: {"id": "deleted-user", "email": "deleted@example.com"},
    )

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user("Bearer valid-token")

    assert exc.value.status_code == 401
