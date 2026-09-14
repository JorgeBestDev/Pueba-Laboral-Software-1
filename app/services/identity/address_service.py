from app import db
from app.models import Address
from app.services.exceptions import ResourceNotFoundError, ValidationError


class AddressService:
    def list(self, user_id: int) -> list[Address]:
        return list(
            db.session.execute(
                db.select(Address)
                .where(Address.user_id == user_id)
                .order_by(Address.is_default.desc(), Address.created_at.desc())
            ).scalars()
        )

    def create(self, user_id: int, data: dict) -> Address:
        required = ("label", "street", "city", "state", "postal_code", "country")
        if any(not isinstance(data.get(field), str) or not data[field].strip() for field in required):
            raise ValidationError("label, street, city, state, postal_code and country are required")
        address = Address(user_id=user_id, **{field: data[field].strip() for field in required})
        if data.get("is_default", False):
            self._clear_default(user_id)
            address.is_default = True
        db.session.add(address)
        db.session.commit()
        return address

    def update(self, user_id: int, address_id: int, data: dict) -> Address:
        address = self._get(user_id, address_id)
        allowed = ("label", "street", "city", "state", "postal_code", "country")
        for field in allowed:
            if field in data:
                if not isinstance(data[field], str) or not data[field].strip():
                    raise ValidationError(f"{field} must be a non-empty string")
                setattr(address, field, data[field].strip())
        if data.get("is_default", False):
            self._clear_default(user_id)
            address.is_default = True
        db.session.commit()
        return address

    def delete(self, user_id: int, address_id: int) -> None:
        address = self._get(user_id, address_id)
        db.session.delete(address)
        db.session.commit()

    def _get(self, user_id: int, address_id: int) -> Address:
        address = db.session.scalar(
            db.select(Address).where(Address.id == address_id, Address.user_id == user_id)
        )
        if address is None:
            raise ResourceNotFoundError("Address not found")
        return address

    def _clear_default(self, user_id: int) -> None:
        addresses = db.session.scalars(
            db.select(Address).where(Address.user_id == user_id, Address.is_default.is_(True))
        )
        for address in addresses:
            address.is_default = False
