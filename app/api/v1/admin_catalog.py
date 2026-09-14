from flask import Blueprint, jsonify, request

from app.api.auth import admin_required
from app.api.serializers import serialize_category, serialize_product, serialize_variant
from app.schemas.validation import require_object
from app.services.catalog import AdminCatalogService

admin_catalog_bp = Blueprint("admin_catalog", __name__, url_prefix="/admin/catalog")
admin_catalog_service = AdminCatalogService()


@admin_catalog_bp.post("/categories")
@admin_required
def create_category():
    category = admin_catalog_service.create_category(require_object(request.get_json(silent=True)))
    return jsonify({"data": serialize_category(category)}), 201


@admin_catalog_bp.patch("/categories/<int:category_id>")
@admin_required
def update_category(category_id: int):
    category = admin_catalog_service.update_category(
        category_id, require_object(request.get_json(silent=True))
    )
    return jsonify({"data": serialize_category(category)})


@admin_catalog_bp.delete("/categories/<int:category_id>")
@admin_required
def delete_category(category_id: int):
    category = admin_catalog_service.delete_category(category_id)
    return jsonify({"data": serialize_category(category)})


@admin_catalog_bp.post("/products")
@admin_required
def create_product():
    product = admin_catalog_service.create_product(require_object(request.get_json(silent=True)))
    return jsonify({"data": serialize_product(product, include_details=True)}), 201


@admin_catalog_bp.patch("/products/<int:product_id>")
@admin_required
def update_product(product_id: int):
    product = admin_catalog_service.update_product(
        product_id, require_object(request.get_json(silent=True))
    )
    return jsonify({"data": serialize_product(product, include_details=True)})


@admin_catalog_bp.delete("/products/<int:product_id>")
@admin_required
def delete_product(product_id: int):
    product = admin_catalog_service.delete_product(product_id)
    return jsonify({"data": serialize_product(product, include_details=True)})


@admin_catalog_bp.post("/products/<int:product_id>/variants")
@admin_required
def create_variant(product_id: int):
    variant = admin_catalog_service.create_variant(
        product_id, require_object(request.get_json(silent=True))
    )
    return jsonify({"data": serialize_variant(variant)}), 201


@admin_catalog_bp.patch("/variants/<int:variant_id>")
@admin_required
def update_variant(variant_id: int):
    variant = admin_catalog_service.update_variant(
        variant_id, require_object(request.get_json(silent=True))
    )
    return jsonify({"data": serialize_variant(variant)})
