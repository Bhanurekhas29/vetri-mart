"""Admin theme settings that follow the Brand screen.

The theme re-reads its settings on every request, so this dictionary adds the company name and logo
from the database each time. The values are cached for a few minutes and refreshed when Brand is saved.
"""

from .constants import BRAND_CACHE_KEY, MEDIA_MARKER


def _brand_overrides():
    from django.core.cache import cache  # imported here because settings.py loads this file very early

    cached = cache.get(BRAND_CACHE_KEY)
    if cached is not None:
        return cached
    try:
        from .models import BrandSettings

        brand = BrandSettings.objects.filter(pk=1).first()
    except Exception:
        return {}  # database not ready yet: use the plain settings, and try again next time
    data = {}
    if brand:
        name = brand.company_name.strip() or 'Vetri Mart'
        data = {
            'site_title': f'{name} Admin',
            'site_header': name,
            'site_brand': name,
            'welcome_sign': f'Welcome to {name} Admin',
            'copyright': name,
        }
        if brand.company_logo:
            data['site_logo'] = data['login_logo'] = f'{MEDIA_MARKER}{brand.company_logo.name}'
    cache.set(BRAND_CACHE_KEY, data, 300)
    return data


class LiveJazzminSettings(dict):
    def items(self):
        merged = dict(super().items())
        merged.update(_brand_overrides())
        return merged.items()
