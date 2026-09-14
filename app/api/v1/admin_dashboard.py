from flask import Blueprint, jsonify

from app.api.auth import admin_required
from app.services.commerce import AdminDashboardService

admin_dashboard_bp = Blueprint("admin_dashboard", __name__, url_prefix="/admin/dashboard")
admin_dashboard_service = AdminDashboardService()


@admin_dashboard_bp.get("")
@admin_required
def get_dashboard_summary():
    return jsonify({"data": admin_dashboard_service.get_summary()})
