from app import db
from app.models import AIInteraction, UserEvent, UserEventType
from app.services.exceptions import ValidationError


class AIService:
    def record_event(
        self,
        event_type: str | None,
        user_id: int | None,
        product_id: int | None,
        metadata: dict | None,
        session_key: str | None,
    ) -> UserEvent:
        try:
            parsed_event_type = UserEventType(event_type)
        except (TypeError, ValueError) as error:
            raise ValidationError("Invalid event_type") from error

        event = UserEvent(
            user_id=user_id,
            product_id=product_id,
            event_type=parsed_event_type,
            metadata_json=metadata,
            session_key=session_key,
        )
        db.session.add(event)
        db.session.commit()
        return event

    def create_interaction(
        self,
        user_id: int | None,
        use_case: str | None,
        prompt: str | None,
        provider: str | None,
        model: str | None,
    ) -> AIInteraction:
        if not use_case or not prompt:
            raise ValidationError("use_case and prompt are required")
        interaction = AIInteraction(
            user_id=user_id,
            use_case=use_case,
            prompt=prompt,
            provider=provider,
            model=model,
            status="pending",
        )
        db.session.add(interaction)
        db.session.commit()
        return interaction
