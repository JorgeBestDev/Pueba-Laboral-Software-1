from flask import current_app

from app import db
from app.models import AIInteraction, UserEvent, UserEventType
from app.services.ai.gemini_provider import GeminiProvider
from app.services.exceptions import ValidationError


class AIService:
    def __init__(self, provider: GeminiProvider | None = None):
        self._provider = provider
        self._configured_provider: GeminiProvider | None = None
        self._provider_signature: tuple[str | None, str] | None = None

    def _get_provider(self, model: str | None = None) -> GeminiProvider:
        if self._provider is not None:
            return self._provider
        api_key = None
        model_name = model
        try:
            api_key = current_app.config.get("GEMINI_API_KEY")
            if not model_name:
                model_name = current_app.config.get("GEMINI_MODEL", "gemini-3.6-flash")
        except RuntimeError:
            pass
        resolved_model = model_name or "gemini-3.6-flash"
        signature = (api_key, resolved_model)
        if self._configured_provider is None or self._provider_signature != signature:
            self._configured_provider = GeminiProvider(
                api_key=api_key,
                model_name=resolved_model,
            )
            self._provider_signature = signature
        return self._configured_provider

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
        session_key: str | None = None,
    ) -> AIInteraction:
        if not use_case or not prompt:
            raise ValidationError("use_case and prompt are required")

        gemini_provider = self._get_provider(model=model)
        response_text, generated_provider, generated_model = gemini_provider.generate_response(
            prompt=prompt,
            use_case=use_case,
            user_id=user_id,
            session_key=session_key,
        )

        interaction = AIInteraction(
            user_id=user_id,
            use_case=use_case,
            prompt=prompt,
            response=response_text,
            provider=provider or generated_provider,
            model=model or generated_model,
            status="completed",
        )
        db.session.add(interaction)
        db.session.commit()
        return interaction
