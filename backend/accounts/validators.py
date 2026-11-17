import re

from django.core.exceptions import ValidationError


def validate_app_password(value):
    """Password rule from the plan: 8+ characters with at least one letter and one number."""
    if len(value) < 8:
        raise ValidationError('Use at least 8 characters.', code='password_too_short')
    if not re.search(r'[A-Za-z]', value) or not re.search(r'\d', value):
        raise ValidationError('Use at least one letter and one number.', code='password_weak')
