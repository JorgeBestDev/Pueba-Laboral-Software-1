from flask import Blueprint, Flask, jsonify

from app.api.errors import register_error_handlers
from app.api.v1 import v1_bp

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/health")
def health():
    return jsonify({"status": "ok", "service": "vokter-api"})


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(api_bp)
    app.register_blueprint(v1_bp)
    register_error_handlers(app)
