import os
from pathlib import Path

from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail
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
mail = Mail()


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
    mail.init_app(app)

    # In development accept any localhost/127.0.0.1 port so Vite (:5173/:5174)
    # and Expo Web (:8081/:8082) work without editing .env on every restart.
    # In production use the explicit list from CORS_ORIGINS.
    is_dev = app.config.get("DEBUG", False)
    origins = r"http://(localhost|127\.0\.0\.1)(:\d+)?" if is_dev else app.config["CORS_ORIGINS"]

    CORS(
        app,
        resources={
            r"/api/*":     {"origins": origins},
            r"/uploads/*": {"origins": origins},   # images served from uploads/
        },
        supports_credentials=app.config["CORS_SUPPORTS_CREDENTIALS"],
        max_age=app.config["CORS_MAX_AGE"],
    )

    # Ensure the uploads directory exists
    upload_folder = Path(app.config["UPLOAD_FOLDER"])
    upload_folder.mkdir(parents=True, exist_ok=True)

    # Serve uploaded product images at /uploads/<filename>
    # (intended for local/demo use only — not production-grade static serving)
    @app.route("/uploads/<path:filename>")
    def serve_upload(filename: str):
        return send_from_directory(str(upload_folder), filename)

    from app import models  # noqa: F401
    from app.api import register_blueprints
    from app.commands import register_commands

    register_blueprints(app)
    register_commands(app)
    return app
