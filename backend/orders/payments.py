"""Talking to Razorpay, kept small and separate so it is easy to test and to swap.

Only two things are asked of Razorpay: create an order (the amount to be paid) and, after the shopper pays, look up
how they paid. The shopper's payment itself happens on Razorpay's own page. We never see or store card details.
The payment is trusted only after its signature is checked here on the server (never because the app says so).
"""

import base64
import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
from decimal import Decimal

from accounts.exceptions import ApiError
from siteconfig.models import PaymentSettings

logger = logging.getLogger(__name__)

API = 'https://api.razorpay.com/v1'
TIMEOUT_SECONDS = 15

# Razorpay's method names -> ours (anything else, such as emi, is left blank)
METHODS = {'upi': 'upi', 'card': 'card', 'netbanking': 'netbanking', 'wallet': 'wallet'}


def keys():
    """(key id, key secret) from Payment settings in the admin, or an error if they are not saved yet."""
    settings = PaymentSettings.load()
    if not settings.is_configured():
        raise ApiError('payments_not_configured', 'Payments are not set up yet. Please try again later.', 503)
    return settings.razorpay_key_id, settings.razorpay_key_secret


def payments_ready():
    return PaymentSettings.load().is_configured()


def _call(method, path, payload=None):
    key_id, key_secret = keys()
    token = base64.b64encode(f'{key_id}:{key_secret}'.encode()).decode()
    request = urllib.request.Request(
        API + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        method=method,
        headers={'Authorization': f'Basic {token}', 'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310 (fixed https address)
        return json.loads(response.read().decode())


def to_paise(amount):
    return int((Decimal(amount) * 100).quantize(Decimal('1')))


def create_razorpay_order(amount, receipt):
    """Asks Razorpay for an order id for this amount (in rupees). Returns Razorpay's answer."""
    try:
        return _call('POST', '/orders', {'amount': to_paise(amount), 'currency': 'INR', 'receipt': receipt[:40]})
    except ApiError:
        raise
    except urllib.error.HTTPError as error:
        logger.error('Razorpay refused to create an order: %s %s', error.code, error.read()[:300])
        raise ApiError('payment_gateway_error', 'Could not start the payment. Please check the payment settings and try again.', 502)
    except Exception:
        logger.exception('Could not reach Razorpay to create an order')
        raise ApiError('payment_gateway_error', 'Could not reach the payment service. Please try again.', 502)


def signature_is_valid(razorpay_order_id, razorpay_payment_id, signature):
    """Razorpay signs "order id|payment id" with the account's secret. Anything else is rejected."""
    if not (razorpay_order_id and razorpay_payment_id and signature):
        return False
    _, secret = keys()
    expected = hmac.new(secret.encode(), f'{razorpay_order_id}|{razorpay_payment_id}'.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, str(signature))


def payment_method(razorpay_payment_id):
    """How the shopper paid (upi, card, netbanking, wallet), or '' if it cannot be looked up. Never blocks an order."""
    try:
        return METHODS.get(_call('GET', f'/payments/{razorpay_payment_id}').get('method', ''), '')
    except Exception:
        logger.warning('Could not look up the payment method for %s', razorpay_payment_id)
        return ''
