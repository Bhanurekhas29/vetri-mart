"""A text field that is saved encrypted in the database.

Used for secrets that the app must be able to read back, such as the SMTP app password and the
Razorpay secret. They cannot be hashed (a hash cannot be turned back into the password), so they are
encrypted with a key that lives in backend/.env (SETTINGS_ENCRYPTION_KEY), not in the database.
"""

import os

from cryptography.fernet import Fernet, InvalidToken
from django.core.exceptions import ImproperlyConfigured
from django.db import models


def _fernet():
    key = os.environ.get('SETTINGS_ENCRYPTION_KEY', '')
    if not key:
        raise ImproperlyConfigured('SETTINGS_ENCRYPTION_KEY is missing from backend/.env, so secrets cannot be saved.')
    return Fernet(key.encode())


class EncryptedTextField(models.TextField):
    description = 'Text saved encrypted in the database'

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if not value:
            return ''
        return _fernet().encrypt(value.encode()).decode()

    def from_db_value(self, value, expression, connection):
        if not value:
            return ''
        try:
            return _fernet().decrypt(value.encode()).decode()
        except (InvalidToken, ImproperlyConfigured):
            # Wrong or missing key: behave as "not set" instead of crashing the admin.
            return ''
