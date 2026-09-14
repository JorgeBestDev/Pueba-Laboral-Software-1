from app import db
from sqlalchemy import func, select

from app.models import Order, OrderItem, OrderStatus, Product, ProductVariant, Review, User
from app.services.exceptions import ResourceNotFoundError, ValidationError


class ReviewService:
    def create_review(
        self,
        user_id: int,
        product_id: int,
        rating: int,
        title: str | None,
        content: str | None,
    ) -> Review:
        if not isinstance(rating, int) or not 1 <= rating <= 5:
            raise ValidationError("rating must be between 1 and 5")
        if db.session.get(User, user_id) is None:
            raise ResourceNotFoundError("User not found")
        if db.session.get(Product, product_id) is None:
            raise ResourceNotFoundError("Product not found")
        purchased = db.session.scalar(
            select(OrderItem)
            .join(Order)
            .where(
                Order.user_id == user_id,
                Order.status.in_(
                    [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.COMPLETED]
                ),
                OrderItem.variant_id.in_(
                    select(ProductVariant.id).where(ProductVariant.product_id == product_id)
                ),
            )
        )
        if purchased is None:
            raise ValidationError("A completed purchase is required to review this product")

        review = Review(
            user_id=user_id,
            product_id=product_id,
            rating=rating,
            title=title,
            content=content,
            is_verified_purchase=True,
        )
        db.session.add(review)
        db.session.commit()
        return review

    def list_for_product(
        self, product_id: int, page: int = 1, per_page: int = 10
    ) -> tuple[list[Review], int, dict]:
        query = select(Review).where(Review.product_id == product_id)
        total = db.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        reviews = db.session.scalars(
            query
            .where(Review.product_id == product_id)
            .order_by(Review.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
        stats = db.session.execute(
            select(func.avg(Review.rating), func.count(Review.id))
            .where(Review.product_id == product_id)
        ).one()
        distribution = {
            str(rating): db.session.scalar(
                select(func.count(Review.id)).where(
                    Review.product_id == product_id, Review.rating == rating
                )
            )
            or 0
            for rating in range(1, 6)
        }
        return reviews, total, {
            "average": round(float(stats[0]), 2) if stats[0] is not None else None,
            "total": stats[1] or 0,
            "distribution": distribution,
        }

    def update(self, user_id: int, review_id: int, data: dict) -> Review:
        review = db.session.scalar(
            select(Review).where(Review.id == review_id, Review.user_id == user_id)
        )
        if review is None:
            raise ResourceNotFoundError("Review not found")
        if "rating" in data and (not isinstance(data["rating"], int) or not 1 <= data["rating"] <= 5):
            raise ValidationError("rating must be between 1 and 5")
        for field in ("rating", "title", "content"):
            if field in data:
                setattr(review, field, data[field])
        db.session.commit()
        return review

    def delete(self, user_id: int, review_id: int) -> None:
        review = db.session.scalar(
            select(Review).where(Review.id == review_id, Review.user_id == user_id)
        )
        if review is None:
            raise ResourceNotFoundError("Review not found")
        db.session.delete(review)
        db.session.commit()
