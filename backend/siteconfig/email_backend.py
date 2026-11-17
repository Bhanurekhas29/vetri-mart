"""Sends email using the SMTP details saved in the admin panel (Email settings).

If Email settings are not filled in and switched on, emails (including OTP codes) are printed in the
server terminal instead, so development keeps working without any email account.
"""

import json
import os
import smtplib
import urllib.error
import urllib.request
from email.utils import parseaddr

from django.conf import settings
from django.core.mail.backends import console, smtp
from django.core.mail.backends.base import BaseEmailBackend

from .constants import brevo_enabled


class _SmtpBackend(smtp.EmailBackend):
    """Introduces itself to the mail server as "localhost".

    By default Python sends this computer's own name (for example DESKTOP-AB12CD3), and Gmail closes the
    connection ("Connection unexpectedly closed") for some computer names. A fixed name works everywhere,
    including on the hosting server.
    """

    @property
    def connection_class(self):
        base = smtplib.SMTP_SSL if self.use_ssl else smtplib.SMTP

        def connect(host, port, **params):
            params['local_hostname'] = 'localhost'
            return base(host, port, **params)

        return connect


class BrevoBackend(BaseEmailBackend):
    """Sends through Brevo's web API (https), for hosts that block SMTP. The key is BREVO_API_KEY.

    The sender address must be verified in the Brevo account (Senders, Domains and dedicated IPs).
    """

    API_URL = 'https://api.brevo.com/v3/smtp/email'

    def send_messages(self, email_messages):
        sent = 0
        for message in email_messages:
            try:
                self._send(message)
                sent += 1
            except Exception:
                if not self.fail_silently:
                    raise
        return sent

    def _send(self, message):
        name, address = parseaddr(message.from_email or settings.DEFAULT_FROM_EMAIL)
        payload = {
            'sender': {'email': address, **({'name': name} if name else {})},
            'to': [{'email': to} for to in message.to],
            'subject': message.subject,
            'textContent': message.body or ' ',
        }
        for content, mimetype in getattr(message, 'alternatives', []):
            if mimetype == 'text/html':
                payload['htmlContent'] = content
        request = urllib.request.Request(
            self.API_URL,
            data=json.dumps(payload).encode('utf-8'),
            headers={'api-key': os.environ['BREVO_API_KEY'], 'accept': 'application/json', 'content-type': 'application/json'},
            method='POST',
        )
        try:
            urllib.request.urlopen(request, timeout=15).read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode('utf-8', 'replace')[:300]
            raise RuntimeError(f'Brevo refused the email ({exc.code}): {detail}') from None


def get_email_connection(cfg, fail_silently=False):
    """The way real emails are sent: Brevo's API on a host that has BREVO_API_KEY, otherwise the saved SMTP details."""
    if brevo_enabled():
        return BrevoBackend(fail_silently=fail_silently)
    return build_smtp_connection(cfg, fail_silently)


def build_smtp_connection(cfg, fail_silently=False):
    return _SmtpBackend(
        host=cfg.smtp_host,
        port=cfg.smtp_port,
        username=cfg.smtp_username,
        password=cfg.app_password.replace(' ', ''),  # Google shows app passwords with spaces
        use_tls=cfg.security == 'tls',
        use_ssl=cfg.security == 'ssl',
        fail_silently=fail_silently,
        timeout=15,
    )


class DatabaseEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        cfg = None
        try:
            from .models import EmailSettings

            cfg = EmailSettings.objects.filter(pk=1).first()
        except Exception:
            cfg = None  # for example the table does not exist yet during first setup

        if cfg is not None and cfg.is_ready():
            connection = get_email_connection(cfg, self.fail_silently)
            for message in email_messages:
                if not message.from_email or message.from_email == settings.DEFAULT_FROM_EMAIL:
                    message.from_email = cfg.formatted_from()
            return connection.send_messages(email_messages)

        return console.EmailBackend(fail_silently=self.fail_silently).send_messages(email_messages)
