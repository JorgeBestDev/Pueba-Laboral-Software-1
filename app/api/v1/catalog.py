from flask import Blueprint, jsonify, make_response, request

from app.api.serializers import serialize_category, serialize_product
from app.services.catalog import CatalogService

catalog_bp = Blueprint("catalog", __name__, url_prefix="/catalog")
catalog_service = CatalogService()

# ---------------------------------------------------------------------------
# Public read-only endpoints — cache aggressively on the client side.
# Products/categories rarely change between requests in the same session,
# so a short max-age (30 s) cuts round-trips noticeably without serving stale
# data for long.  The admin panel never hits these endpoints.
# ---------------------------------------------------------------------------
_CACHE_SHORT = "public, max-age=30, stale-while-revalidate=60"
_CACHE_MEDIUM = "public, max-age=120, stale-while-revalidate=300"


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
    resp = make_response(jsonify(
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
    ))
    resp.headers["Cache-Control"] = _CACHE_SHORT
    return resp


@catalog_bp.get("/products/<int:product_id>")
def get_product(product_id: int):
    product = catalog_service.get_product(product_id)
    resp = make_response(jsonify({"data": serialize_product(product, include_details=True)}))
    resp.headers["Cache-Control"] = _CACHE_SHORT
    return resp


@catalog_bp.get("/products/slug/<string:slug>")
def get_product_by_slug(slug: str):
    product = catalog_service.get_product_by_slug(slug)
    resp = make_response(jsonify({"data": serialize_product(product, include_details=True)}))
    resp.headers["Cache-Control"] = _CACHE_SHORT
    return resp


@catalog_bp.get("/filters")
def list_filters():
    resp = make_response(jsonify({"data": catalog_service.list_filters()}))
    resp.headers["Cache-Control"] = _CACHE_MEDIUM
    return resp


@catalog_bp.get("/categories")
def list_categories():
    categories = catalog_service.list_categories()
    resp = make_response(jsonify({"data": [serialize_category(category) for category in categories]}))
    resp.headers["Cache-Control"] = _CACHE_MEDIUM
    return resp
