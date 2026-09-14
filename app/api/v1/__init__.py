from flask import Blueprint, jsonify

from app.api.v1.ai import ai_bp
from app.api.v1.cart import cart_bp
from app.api.v1.catalog import catalog_bp
from app.api.v1.identity import identity_bp
from app.api.v1.orders import orders_bp
from app.api.v1.users import users_bp
from app.api.v1.social import social_bp
from app.api.v1.wishlist import wishlist_bp
from app.api.v1.admin_catalog import admin_catalog_bp

v1_bp = Blueprint("v1", __name__, url_prefix="/api/v1")


@v1_bp.get("/health")
def health():
    return jsonify({"data": {"status": "ok", "service": "vokter-api", "version": "v1"}})


v1_bp.register_blueprint(catalog_bp)
v1_bp.register_blueprint(cart_bp)
v1_bp.register_blueprint(social_bp)
v1_bp.register_blueprint(ai_bp)
v1_bp.register_blueprint(identity_bp)
v1_bp.register_blueprint(orders_bp)
v1_bp.register_blueprint(users_bp)
v1_bp.register_blueprint(wishlist_bp)
v1_bp.register_blueprint(admin_catalog_bp)
