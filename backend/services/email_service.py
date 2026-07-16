import os
import smtplib
from email.message import EmailMessage


def send_email(to: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM") or user

    if not host or not user or not password:
        raise RuntimeError("SMTP nao configurado (defina SMTP_HOST, SMTP_USER, SMTP_PASSWORD)")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = to
    message.set_content(text_body or "Abra este e-mail em um cliente compativel com HTML.")
    message.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(host, port, timeout=15) as server:
        server.starttls()
        server.login(user, password)
        server.send_message(message)


def send_password_reset_email(to: str, reset_url: str, ttl_minutes: int) -> None:
    subject = "Redefinicao de senha - FinCouple"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#D92D7D;">Redefinir senha</h2>
      <p>Recebemos um pedido para redefinir a senha da sua conta FinCouple.</p>
      <p>
        <a href="{reset_url}"
           style="display:inline-block;padding:12px 24px;background:#EC3E92;color:#fff;
                  border-radius:10px;text-decoration:none;font-weight:bold;">
          Redefinir minha senha
        </a>
      </p>
      <p>Esse link expira em {ttl_minutes} minutos. Se voce nao pediu essa redefinicao, ignore este e-mail.</p>
    </div>
    """
    text_body = (
        "Recebemos um pedido para redefinir a senha da sua conta FinCouple.\n\n"
        f"Acesse o link a seguir para criar uma nova senha (expira em {ttl_minutes} minutos):\n"
        f"{reset_url}\n\n"
        "Se voce nao pediu essa redefinicao, ignore este e-mail."
    )
    send_email(to, subject, html_body, text_body)
