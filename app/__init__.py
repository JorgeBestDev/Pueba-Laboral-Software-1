import os
from pathlib import Path

from flask import Flask
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

from app.config import config_by_name

db = SQLAlchemy()
migrate = Migrate()
# In-memory limiter: no default limits are applied globally, only the
# sensitive admin auth endpoints opt in via @limiter.limit(...). This is
# enough to slow down brute-force attempts against the admin panel without
# introducing an external dependency (Redis, etc.) for a single-instance deploy.
limiter = Limiter(key_func=get_remote_address)


def create_app(config_name: str | None = None) -> Flask:
    app = Flask(__name__)
    selected_config = config_name or os.getenv(
        "APP_ENV", os.getenv("FLASK_ENV", "development")
    )
    app.config.from_object(config_by_name.get(selected_config, config_by_name["development"]))
    if selected_config == "production" and app.config["SECRET_KEY"] == "development-only-key":
        raise RuntimeError("SECRET_KEY must be configured in production")
    database_uri = app.config["SQLALCHEMY_DATABASE_URI"]
    if database_uri.startswith("sqlite:///") and database_uri != "sqlite:///:memory:":
        Path(database_uri.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=app.config["CORS_SUPPORTS_CREDENTIALS"],
        max_age=app.config["CORS_MAX_AGE"],
    )

    from app import models  # noqa: F401
    from app.api import register_blueprints
    from app.commands import register_commands

    register_blueprints(app)
    register_commands(app)
    return app
