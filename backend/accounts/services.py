"""The logic behind login: sending OTPs, checking them, and issuing tokens."""

import logging
import secrets
from datetime import timedelta

from django.core import signing
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from .exceptions import ApiError
from .models import OTPCode, User

logger = logging.getLogger(__name__)

MAX_SENDS_PER_HOUR = 5
RESEND_GAP_SECONDS = 30
REGISTRATION_TOKEN_MINUTES = 15
_REGISTER_SALT = 'vetrimart-register'


def otp_email_content(code, purpose):
    """The OTP email: (subject, plain text, HTML). The plain text is what simple mail apps show; the HTML is the branded version."""
    reset = purpose == OTPCode.Purpose.RESET_PASSWORD
    subject = 'Reset your Vetri Mart password' if reset else 'Your Vetri Mart login code'
    intro = 'Use this code to reset your password.' if reset else 'Use this code to log in to Vetri Mart.'
    minutes = OTPCode.VALID_MINUTES
    text = (
        f'Your Vetri Mart verification code is {code}.\n'
        f'{intro} It expires in {minutes} minutes. If you did not ask for it, ignore this email.'
    )
    html = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F7F8FC;font-family:Arial,Helvetica,sans-serif;color:#1B1F2A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FC;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#FFFFFF;border:1px solid #E3E6F0;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0B1F4B;padding:18px 24px;font-size:20px;font-weight:bold;color:#FFFFFF;">Vetri<span style="color:#F57C00;">Mart</span></td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 6px;font-size:16px;font-weight:bold;">{'Reset your password' if reset else 'Your login code'}</p>
          <p style="margin:0 0 18px;font-size:14px;color:#6B7280;">{intro}</p>
          <div style="text-align:center;margin:0 0 18px;">
            <span style="display:inline-block;background:#E8ECF7;border-radius:10px;padding:14px 22px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#0B1F4B;">{code}</span>
          </div>
          <p style="margin:0 0 6px;font-size:13px;color:#6B7280;">This code expires in {minutes} minutes. Never share it with anyone.</p>
          <p style="margin:0;font-size:13px;color:#6B7280;">If you did not ask for it, you can ignore this email.</p>
        </td></tr>
        <tr><td style="padding:12px 24px;border-top:1px solid #E3E6F0;font-size:12px;color:#9CA3AF;">Vetri Mart</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    return subject, text, html


def send_otp(email, purpose):
    """Create a hashed OTP and email it. Enforces 5 sends per hour and a 30-second gap."""
    now = timezone.now()
    recent = OTPCode.objects.filter(email=email, created_at__gte=now - timedelta(hours=1))
    if recent.count() >= MAX_SENDS_PER_HOUR:
        raise ApiError('otp_rate_limited', 'Too many codes requested. Please try again in an hour.', 429)
    last = recent.order_by('-created_at').first()
    if last:
        wait = RESEND_GAP_SECONDS - int((now - last.created_at).total_seconds())
        if wait > 0:
            raise ApiError('otp_resend_too_soon', f'Please wait {wait} seconds before asking for a new code.', 429)

    # Only the newest code works: switch off any earlier unused ones.
    OTPCode.objects.filter(email=email, purpose=purpose, used_at__isnull=True).update(expires_at=now)

    code = f'{secrets.randbelow(10**6):06d}'
    OTPCode.issue(email, purpose, code)
    try:
        subject, text, html = otp_email_content(code, purpose)
        message = EmailMultiAlternatives(subject, text, None, [email])  # from: the sender saved in Email settings
        message.attach_alternative(html, 'text/html')
        message.send(fail_silently=False)
    except Exception:
        # For example a wrong SMTP password in Email settings. The details go to the server log, not the user.
        logger.exception('Could not send the OTP email to %s', email)
        raise ApiError('email_failed', "We couldn't send the email right now. Please try again in a moment.", 503)


def check_otp(email, purpose, code):
    """Return normally if the code is right. Otherwise raise a clear error."""
    otp = OTPCode.objects.filter(email=email, purpose=purpose, used_at__isnull=True).order_by('-created_at').first()
    if otp is None or not otp.is_usable():
        raise ApiError('otp_expired', 'That code has expired. Please request a new one.')
    if otp.verify(code):
        return
    left = max(OTPCode.MAX_ATTEMPTS - otp.attempts, 0)
    if left == 0:
        raise ApiError('otp_locked', 'Too many wrong tries. Please request a new code.')
    raise ApiError('invalid_otp', f"That code isn't right. {left} {'try' if left == 1 else 'tries'} left.")


def make_registration_token(email):
    return signing.dumps({'email': email}, salt=_REGISTER_SALT)


def read_registration_token(token):
    try:
        data = signing.loads(token, salt=_REGISTER_SALT, max_age=REGISTRATION_TOKEN_MINUTES * 60)
    except signing.BadSignature:
        raise ApiError('registration_expired', 'Your sign-up session expired. Please start again.')
    return data['email']


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def revoke_all_tokens(user):
    """Used for 'Log out from all devices' and after a password reset."""
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def find_active_user(email):
    return User.objects.filter(email=email, is_active=True).first()
