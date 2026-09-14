from flask import Blueprint, jsonify, request

from app.schemas.validation import (
    integer_value,
    object_value,
    optional_string,
    string_value,
    validate_payload,
)
from app.services.ai import AIService

ai_bp = Blueprint("ai", __name__, url_prefix="/ai")
ai_service = AIService()


@ai_bp.post("/events")
def create_event():
    payload = validate_payload(
        request.get_json(silent=True),
        required={"event_type": lambda value: string_value(value, field="event_type", max_length=50)},
        optional={
            "user_id": lambda value: integer_value(value, field="user_id", minimum=1),
            "product_id": lambda value: integer_value(value, field="product_id", minimum=1),
            "metadata": lambda value: object_value(value, field="metadata"),
            "session_key": lambda value: string_value(value, field="session_key", max_length=255),
        },
    )
    event = ai_service.record_event(
        event_type=payload.get("event_type"),
        user_id=payload.get("user_id"),
        product_id=payload.get("product_id"),
        metadata=payload.get("metadata"),
        session_key=payload.get("session_key"),
    )
    return jsonify({"data": {"id": event.id, "event_type": event.event_type.value}}), 201


@ai_bp.post("/interactions")
def create_interaction():
    payload = validate_payload(
        request.get_json(silent=True),
        required={
            "use_case": lambda value: string_value(value, field="use_case", max_length=100),
            "prompt": lambda value: string_value(value, field="prompt", max_length=10000),
        },
        optional={
            "user_id": lambda value: integer_value(value, field="user_id", minimum=1),
            "provider": lambda value: optional_string(value, field="provider", max_length=100),
            "model": lambda value: optional_string(value, field="model", max_length=100),
        },
    )
    interaction = ai_service.create_interaction(
        user_id=payload.get("user_id"),
        use_case=payload.get("use_case"),
        prompt=payload.get("prompt"),
        provider=payload.get("provider"),
        model=payload.get("model"),
    )
    return jsonify({"data": {"id": interaction.id, "status": interaction.status}}), 201
