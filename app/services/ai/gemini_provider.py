import logging

from sqlalchemy import or_

from app.models.ai.user_event import UserEvent
from app.models.catalog import Product

logger = logging.getLogger(__name__)


class GeminiProvider:
    def __init__(self, api_key: str | None = None, model_name: str = "gemini-3.6-flash"):
        self.api_key = api_key
        self.model_name = model_name
        self._configured = False

    def _ensure_configured(self) -> bool:
        if not self.api_key:
            return False
        if not self._configured:
            try:
                import google.generativeai as genai

                genai.configure(api_key=self.api_key)
                self._configured = True
            except Exception as e:
                logger.warning("Failed to configure Google Generative AI: %s", e)
                return False
        return True

    def _build_catalog_context(self) -> str:
        try:
            products = Product.query.filter_by(is_active=True).limit(30).all()
            if not products:
                return "Catálogo actualmente vacío o sin productos activos."

            lines = ["Productos disponibles en la tienda Vokter:"]
            for p in products:
                cats = ", ".join(c.name for c in p.categories) if p.categories else "General"
                brand = f" (Marca: {p.brand})" if p.brand else ""
                lines.append(
                    f"- ID {p.id}: {p.name}{brand} - Precio: ${p.base_price} - Categorías: {cats}. Descripción: {p.description or 'N/A'}"
                )
            return "\n".join(lines)
        except Exception as e:
            logger.warning("Could not build catalog context: %s", e)
            return "Catálogo general de Vokter disponible en línea."

    def _build_user_history_context(
        self, user_id: int | None = None, session_key: str | None = None
    ) -> str:
        if not user_id and not session_key:
            return ""
        try:
            conditions = []
            if user_id:
                conditions.append(UserEvent.user_id == user_id)
            if session_key:
                conditions.append(UserEvent.session_key == session_key)
            events = (
                UserEvent.query.filter(or_(*conditions))
                .order_by(UserEvent.id.desc())
                .limit(5)
                .all()
            )
            if not events:
                return ""
            lines = ["Actividad reciente del usuario en la sesión:"]
            for ev in events:
                prod = f" (Producto ID: {ev.product_id})" if ev.product_id else ""
                lines.append(f"- {ev.event_type.value}{prod}")
            return "\n".join(lines)
        except Exception as e:
            logger.warning("Could not build user history context: %s", e)
            return ""

    def generate_response(
        self,
        prompt: str,
        use_case: str = "shopping_assistant",
        user_id: int | None = None,
        session_key: str | None = None,
    ) -> tuple[str, str, str]:
        """Generate an AI response.

        Returns: (response_text, provider_name, model_name)
        """
        if not self._ensure_configured():
            fallback_text = (
                "Hola, soy el asistente de Vokter. En este momento el servicio de IA generativa "
                "no tiene configurada una clave de acceso (GEMINI_API_KEY). "
                "Puedes explorar nuestro catálogo directamente en la tienda o contactar a soporte."
            )
            return fallback_text, "fallback", "local-rule-engine"

        try:
            import google.generativeai as genai

            catalog_context = self._build_catalog_context()
            user_context = self._build_user_history_context(user_id=user_id, session_key=session_key)

            instructions = [
                "Eres el asistente virtual inteligente y concierge de la tienda en línea Vokter.",
                "Tu objetivo es ayudar a los usuarios a encontrar productos, responder preguntas sobre el catálogo,",
                "hacer recomendaciones personalizadas y guiar compras de forma amable, concisa y elegante.\n",
                "Instrucciones:",
                "1. Si el usuario busca un producto o recomendación, básate prioritariamente en el catálogo disponible.",
                "2. Sé cordial, conciso y directo (respuestas de 2 a 4 oraciones usualmente).",
                "3. No inventes precios ni productos que no estén en el catálogo si te piden algo específico de la tienda.",
                "4. Si hay actividad previa del usuario, úsala sutilmente para personalizar las sugerencias.",
                "5. Responde en el mismo idioma del usuario (por defecto español).\n",
                f"Contexto del catálogo:\n{catalog_context}",
            ]
            if user_context:
                instructions.append(f"\n{user_context}")

            system_instruction = "\n".join(instructions)

            model = genai.GenerativeModel(
                model_name=self.model_name,
                system_instruction=system_instruction,
            )

            response = model.generate_content(prompt)
            reply = (
                response.text.strip()
                if response.text
                else "No pude generar una respuesta en este momento."
            )
            return reply, "google", self.model_name
        except Exception as e:
            logger.error("Error invoking Gemini API: %s", e)
            fallback_text = (
                "Disculpa, hubo un problema momentáneo comunicándome con el servicio de IA. "
                "Por favor intenta de nuevo en unos momentos o navega por nuestro catálogo."
            )
            return fallback_text, "google", self.model_name
