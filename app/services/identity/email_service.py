from flask import current_app
from flask_mail import Message


class EmailService:
    def send_password_reset(self, recipient: str, reset_url: str) -> None:
        mail = current_app.extensions.get("mail")
        if mail is None or not current_app.config.get("MAIL_SERVER"):
            raise RuntimeError("Email delivery is not configured")

        message = Message(
            subject="Restablece tu contraseña de Vokter",
            recipients=[recipient],
            body=(
                "Solicitaste restablecer la contraseña de tu cuenta Vokter.\n\n"
                f"Abre este enlace para continuar:\n{reset_url}\n\n"
                "El enlace vence pronto y solo puede utilizarse una vez. "
                "Si no solicitaste este cambio, puedes ignorar este correo."
            ),
            html=(
                "<p>Solicitaste restablecer la contraseña de tu cuenta Vokter.</p>"
                f'<p><a href="{reset_url}">Restablecer contraseña</a></p>'
                "<p>El enlace vence pronto y solo puede utilizarse una vez. "
                "Si no solicitaste este cambio, puedes ignorar este correo.</p>"
            ),
        )
        mail.send(message)
