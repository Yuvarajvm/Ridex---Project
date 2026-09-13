"""Email provider abstraction for RIDEX.

Supports Console (dev/test), SMTP, and future providers (Resend, SendGrid).
The active provider is selected via the RIDEX_EMAIL_PROVIDER environment variable.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class EmailProvider(ABC):
    """Base interface for email sending."""

    @abstractmethod
    async def send(
        self,
        to: str,
        subject: str,
        body_html: str,
        body_text: str | None = None,
    ) -> bool:
        """Send an email. Returns True on success."""
        ...


class ConsoleEmailProvider(EmailProvider):
    """
    Development email provider — prints emails to console/log.

    Use when no external email service is configured.
    """

    async def send(
        self,
        to: str,
        subject: str,
        body_html: str,
        body_text: str | None = None,
    ) -> bool:
        logger.info(
            "=== RIDEX EMAIL (Console Provider) ===\n"
            "  To: %s\n"
            "  Subject: %s\n"
            "  Body: %s\n"
            "======================================",
            to,
            subject,
            body_text or body_html,
        )
        return True


class SMTPEmailProvider(EmailProvider):
    """
    Production-ready SMTP email provider.

    Requires RIDEX_EMAIL_HOST, RIDEX_EMAIL_PORT, RIDEX_EMAIL_USERNAME,
    RIDEX_EMAIL_PASSWORD, and RIDEX_EMAIL_FROM environment variables.
    """

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        from_address: str,
        use_tls: bool = True,
    ) -> None:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_address = from_address
        self.use_tls = use_tls

    async def send(
        self,
        to: str,
        subject: str,
        body_html: str,
        body_text: str | None = None,
    ) -> bool:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.from_address
            msg["To"] = to

            if body_text:
                msg.attach(MIMEText(body_text, "plain"))
            msg.attach(MIMEText(body_html, "html"))

            with smtplib.SMTP(self.host, self.port) as server:
                if self.use_tls:
                    server.starttls()
                server.login(self.username, self.password)
                server.sendmail(self.from_address, to, msg.as_string())

            logger.info("Email sent to %s via SMTP", to)
            return True
        except Exception:
            logger.exception("Failed to send email to %s via SMTP", to)
            return False


class EmailService:
    """
    Application email service — factory-selected provider.

    Usage:
        email_service = EmailService.create()
        await email_service.send_password_reset(email, reset_url)
    """

    def __init__(self, provider: EmailProvider) -> None:
        self.provider = provider

    @classmethod
    def create(cls) -> "EmailService":
        """Create email service from environment configuration."""
        from app.core.config import get_settings

        settings = get_settings()

        if settings.email_provider == "smtp":
            provider = SMTPEmailProvider(
                host=settings.email_host,
                port=settings.email_port,
                username=settings.email_username,
                password=settings.email_password,
                from_address=settings.email_from,
                use_tls=settings.email_use_tls,
            )
        else:
            provider = ConsoleEmailProvider()

        return cls(provider=provider)

    async def send_password_reset(self, to_email: str, reset_url: str) -> bool:
        """Send a password reset email."""
        subject = "RIDEX — Reset Your Password"
        body_html = f"""
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #17203b;">Reset Your RIDEX Password</h2>
            <p style="color: #555; line-height: 1.6;">
                We received a request to reset your password. Click the button below to
                set a new password. This link will expire in 15 minutes.
            </p>
            <a href="{reset_url}"
               style="display: inline-block; background: #26345f; color: #fff;
                      padding: 14px 28px; border-radius: 12px; text-decoration: none;
                      font-weight: 700; margin: 16px 0;">
                Reset Password
            </a>
            <p style="color: #999; font-size: 13px; margin-top: 24px;">
                If you did not request this, you can safely ignore this email.
            </p>
        </div>
        """
        body_text = (
            f"Reset your RIDEX password by visiting: {reset_url}\n\n"
            "This link expires in 15 minutes. If you did not request this, ignore this email."
        )
        return await self.provider.send(to_email, subject, body_html, body_text)
