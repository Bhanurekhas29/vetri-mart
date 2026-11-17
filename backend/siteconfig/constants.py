# Small shared values. This file imports nothing from Django models, so settings.py can use it safely.

# Where the admin theme finds the Brand logo in the cache.
BRAND_CACHE_KEY = 'siteconfig_brand_v1'

# A logo path starting with this is a file in the media folder, not in the static folder.
MEDIA_MARKER = '__media__/'


def brevo_enabled():
    """True on a host where emails go out through Brevo's web API (BREVO_API_KEY is set) instead of SMTP.

    Some hosts, such as Render's free plan, block SMTP, so Gmail login cannot be used there.
    """
    import os

    return bool(os.environ.get('BREVO_API_KEY'))
