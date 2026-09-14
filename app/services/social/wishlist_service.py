from sqlalchemy import select

from app import db
from app.models import Product, Wishlist, WishlistItem
from app.services.exceptions import ResourceNotFoundError


class WishlistService:
    def get_or_create(self, user_id: int) -> Wishlist:
        wishlist = db.session.scalar(select(Wishlist).where(Wishlist.user_id == user_id))
        if wishlist is None:
            wishlist = Wishlist(user_id=user_id)
            db.session.add(wishlist)
            db.session.commit()
        return wishlist

    def add_item(self, user_id: int, product_id: int) -> Wishlist:
        wishlist = self.get_or_create(user_id)
        if db.session.get(Product, product_id) is None:
            raise ResourceNotFoundError("Product not found")
        existing = db.session.scalar(
            select(WishlistItem).where(
                WishlistItem.wishlist_id == wishlist.id,
                WishlistItem.product_id == product_id,
            )
        )
        if existing is None:
            db.session.add(WishlistItem(wishlist=wishlist, product_id=product_id))
            db.session.commit()
        return wishlist

    def remove_item(self, user_id: int, item_id: int) -> Wishlist:
        wishlist = self.get_or_create(user_id)
        item = db.session.scalar(
            select(WishlistItem).where(
                WishlistItem.id == item_id,
                WishlistItem.wishlist_id == wishlist.id,
            )
        )
        if item is None:
            raise ResourceNotFoundError("Wishlist item not found")
        db.session.delete(item)
        db.session.commit()
        return wishlist
