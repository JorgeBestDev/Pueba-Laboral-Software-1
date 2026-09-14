from flask import Blueprint, jsonify, request

from app.api.auth import admin_required
from app.api.serializers import serialize_category, serialize_product, serialize_variant
from app.schemas.validation import require_object
from app.services.catalog import AdminCatalogService

admin_catalog_bp = Blueprint("admin_catalog", __name__, url_prefix="/admin/catalog")
admin_catalog_service = AdminCatalogService()


@admin_catalog_bp.get("/categories")
@admin_required
def list_categories():
    categories = admin_catalog_service.list_categories()
    return jsonify({"data": [serialize_category(category) for category in categories]})


@admin_catalog_bp.get("/products")
@admin_required
def list_products():
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 20, type=int), 1), 100)
    products, total = admin_catalog_service.list_products(
        search=request.args.get("q"), page=page, per_page=per_page
    )
    return jsonify(
        {
            "data": [serialize_product(product, include_variants=True) for product in products],
            "meta": {
                "page": page,
                "per_page": per_page,
                "count": len(products),
                "total": total,
                "pages": (total + per_page - 1) // per_page,
            },
        }
    )


@admin_catalog_bp.get("/products/<int:product_id>")
@admin_required
def get_product(product_id: int):
    from app.services.catalog import CatalogService

    product = CatalogService().get_product(product_id)
    return jsonify({"data": serialize_product(product, include_details=True)})


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
