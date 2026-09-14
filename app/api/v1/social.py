from flask import Blueprint, g, jsonify, request

from app.api.auth import token_required
from app.api.serializers import serialize_review
from app.services.catalog import CatalogService
from app.services.social import ReviewService
from app.schemas.validation import integer_value, optional_string, require_object, validate_payload

social_bp = Blueprint("social", __name__, url_prefix="/social")
review_service = ReviewService()
catalog_service = CatalogService()


@social_bp.post("/reviews")
@token_required
def create_review():
    payload = validate_payload(
        request.get_json(silent=True),
        required={
            "product_id": lambda value: integer_value(value, field="product_id", minimum=1),
            "rating": lambda value: integer_value(value, field="rating", minimum=1),
        },
        optional={
            "title": lambda value: optional_string(value, field="title", max_length=120),
            "content": lambda value: optional_string(value, field="content", max_length=2000),
        },
    )
    if payload["rating"] > 5:
        from app.services.exceptions import ValidationError
        raise ValidationError("rating must be at most 5")
    review = review_service.create_review(
        user_id=g.current_user.id,
        product_id=payload["product_id"],
        rating=payload["rating"],
        title=payload.get("title"),
        content=payload.get("content"),
    )
    return jsonify({"data": serialize_review(review)}), 201


@social_bp.get("/products/<int:product_id>/reviews")
def list_product_reviews(product_id: int):
    catalog_service.get_product(product_id)
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 10, type=int), 1), 100)
    reviews, total, summary = review_service.list_for_product(
        product_id, page=page, per_page=per_page
    )
    return jsonify(
        {
            "data": [serialize_review(review) for review in reviews],
            "summary": summary,
            "meta": {
                "page": page,
                "per_page": per_page,
                "count": len(reviews),
                "total": total,
                "pages": (total + per_page - 1) // per_page,
            },
        }
    )


@social_bp.patch("/reviews/<int:review_id>")
@token_required
def update_review(review_id: int):
    review = review_service.update(g.current_user.id, review_id, require_object(request.get_json(silent=True)))
    return jsonify({"data": serialize_review(review)})


@social_bp.delete("/reviews/<int:review_id>")
@token_required
def delete_review(review_id: int):
    review_service.delete(g.current_user.id, review_id)
    return "", 204
