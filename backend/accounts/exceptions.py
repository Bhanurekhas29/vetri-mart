"""Every API error leaves the server in one shape: {code, message, fields}."""

from rest_framework.exceptions import APIException, ValidationError
from rest_framework.views import exception_handler


class ApiError(APIException):
    """An error with our own short code, for example 'invalid_otp'."""

    def __init__(self, code, message, status_code=400):
        self.status_code = status_code
        super().__init__(detail=message, code=code)


def _first_message(value):
    while isinstance(value, (list, tuple)) and value:
        value = value[0]
    return str(value)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    if isinstance(exc, ValidationError):
        fields = {}
        message = 'Please check your details and try again.'
        if isinstance(data, dict):
            for key, value in data.items():
                fields[key] = [str(v) for v in value] if isinstance(value, (list, tuple)) else [str(value)]
            general = fields.pop('non_field_errors', None)
            if general:
                message = general[0]
            elif fields:
                message = next(iter(fields.values()))[0]
        elif isinstance(data, (list, tuple)) and data:
            message = _first_message(data)
        response.data = {'code': 'validation_error', 'message': message, 'fields': fields}
        return response

    detail = data.get('detail', '') if isinstance(data, dict) else data
    code = data.get('code') if isinstance(data, dict) and isinstance(data.get('code'), str) else None
    if code is None:
        codes = exc.get_codes() if hasattr(exc, 'get_codes') else None
        code = codes if isinstance(codes, str) else getattr(exc, 'default_code', 'error')
    response.data = {'code': code, 'message': _first_message(detail), 'fields': {}}
    return response
