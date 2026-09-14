from flask import Blueprint, jsonify, request

from app.api.serializers import serialize_category, serialize_product
from app.services.catalog import CatalogService

catalog_bp = Blueprint("catalog", __name__, url_prefix="/catalog")
catalog_service = CatalogService()


@catalog_bp.get("/products")
def list_products():
    search = request.args.get("q", "").strip()
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 20, type=int), 1), 100)
    min_price = request.args.get("min_price", type=float)
    max_price = request.args.get("max_price", type=float)
    products, total = catalog_service.list_products(
        search=search,
        featured=request.args.get("featured") == "true",
        page=page,
        per_page=per_page,
        category=request.args.get("category"),
        brand=request.args.get("brand"),
        min_price=min_price,
        max_price=max_price,
        available=request.args.get("available") == "true",
        sort=request.args.get("sort", "newest"),
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


@catalog_bp.get("/products/<int:product_id>")
def get_product(product_id: int):
    product = catalog_service.get_product(product_id)
    return jsonify({"data": serialize_product(product, include_details=True)})


@catalog_bp.get("/products/slug/<string:slug>")
def get_product_by_slug(slug: str):
    product = catalog_service.get_product_by_slug(slug)
    return jsonify({"data": serialize_product(product, include_details=True)})


@catalog_bp.get("/filters")
def list_filters():
    return jsonify({"data": catalog_service.list_filters()})


@catalog_bp.get("/categories")
def list_categories():
    categories = catalog_service.list_categories()
    return jsonify({"data": [serialize_category(category) for category in categories]})
