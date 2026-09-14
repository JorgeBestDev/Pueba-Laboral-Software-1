import re
from collections.abc import Mapping
from typing import Any, Callable

from app.services.exceptions import ValidationError


def require_object(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("JSON body must be an object")
    return payload


def validate_payload(
    payload: Any,
    *,
    required: Mapping[str, Callable[[Any], Any]] | None = None,
    optional: Mapping[str, Callable[[Any], Any]] | None = None,
    allow_unknown: bool = False,
) -> dict[str, Any]:
    """Validate and normalize a JSON object at the HTTP boundary."""
    data = require_object(payload)
    required = required or {}
    optional = optional or {}
    if not allow_unknown:
        unknown = set(data) - set(required) - set(optional)
        if unknown:
            raise ValidationError(f"Unknown fields: {', '.join(sorted(unknown))}")
    for field, validator in required.items():
        if field not in data:
            raise ValidationError(f"{field} is required")
        data[field] = validator(data[field])
    for field, validator in optional.items():
        if field in data and data[field] is not None:
            data[field] = validator(data[field])
    return data


def require_int(payload: dict[str, Any], field: str) -> int:
    value = payload.get(field)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError(f"{field} must be an integer")
    return value


def require_string(
    payload: dict[str, Any],
    field: str,
    *,
    max_length: int = 255,
    allow_empty: bool = False,
) -> str:
    value = payload.get(field)
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be a string")
    value = value.strip()
    if not allow_empty and not value:
        raise ValidationError(f"{field} is required")
    if len(value) > max_length:
        raise ValidationError(f"{field} must not exceed {max_length} characters")
    return value


def string_value(value: Any, *, field: str, max_length: int = 255) -> str:
    return require_string({field: value}, field, max_length=max_length)


def optional_string(value: Any, *, field: str, max_length: int = 255) -> str | None:
    if value is None:
        return None
    return string_value(value, field=field, max_length=max_length)


def integer_value(value: Any, *, field: str, minimum: int | None = None) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError(f"{field} must be an integer")
    if minimum is not None and value < minimum:
        raise ValidationError(f"{field} must be at least {minimum}")
    return value


def boolean_value(value: Any, *, field: str) -> bool:
    if not isinstance(value, bool):
        raise ValidationError(f"{field} must be a boolean")
    return value


def object_value(value: Any, *, field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValidationError(f"{field} must be an object")
    return value


def email_value(value: Any) -> str:
    email = string_value(value, field="email", max_length=255).lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValidationError("email must be valid")
    return email


def enum_value(value: Any, *, field: str, choices: set[str]) -> str:
    result = string_value(value, field=field)
    if result not in choices:
        raise ValidationError(f"{field} must be one of: {', '.join(sorted(choices))}")
    return result
