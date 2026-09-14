import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


def normalize_database_url(url: str) -> str:
    """Use the psycopg v3 driver declared by this project for PostgreSQL."""
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "development-only-key")
    SQLALCHEMY_DATABASE_URI = normalize_database_url(
        os.getenv(
            "DATABASE_URL",
            f"sqlite:///{BASE_DIR / 'instance' / 'vokter.db'}",
        )
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    CORS_ORIGINS = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", FRONTEND_URL).split(",")
        if origin.strip()
    )
    CORS_SUPPORTS_CREDENTIALS = os.getenv("CORS_SUPPORTS_CREDENTIALS", "false").lower() == "true"
    CORS_MAX_AGE = int(os.getenv("CORS_MAX_AGE", "600"))
    JSON_SORT_KEYS = False
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=2)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
    # Self-contained math captcha for the admin login (no external service/keys).
    CAPTCHA_TOKEN_TTL_SECONDS = int(os.getenv("CAPTCHA_TOKEN_TTL_SECONDS", "300"))
    ADMIN_LOGIN_RATE_LIMIT = os.getenv("ADMIN_LOGIN_RATE_LIMIT", "8 per minute")
    ADMIN_CAPTCHA_RATE_LIMIT = os.getenv("ADMIN_CAPTCHA_RATE_LIMIT", "30 per minute")
    RATELIMIT_ENABLED = os.getenv("RATELIMIT_ENABLED", "true").lower() == "true"


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


class ProductionConfig(Config):
    DEBUG = False
    CORS_SUPPORTS_CREDENTIALS = True


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
