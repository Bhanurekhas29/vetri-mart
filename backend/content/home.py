"""Builds the Home page: the admin's sections, in order, each with what it needs to be drawn.

A section with nothing to show (no banners, no live deal, no products) is left out, so the app
never has to draw an empty block.
"""

from django.utils import timezone

from catalog.models import Category
from catalog.queries import card_queryset
from catalog.serializers import ProductCardSerializer
from siteconfig.models import AnnouncementSettings

from .models import Announcement, Deal, HomeSection
from .serializers import BannerSerializer, CategoryTileSerializer, DealSerializer


def _cards_in_order(product_ids, request, limit=None, sponsored_first=False):
    """Product cards in the order the admin listed them. Products that cannot be shown are skipped."""
    by_id = {p.id: p for p in card_queryset().filter(id__in=product_ids)}
    position = {pid: i for i, pid in enumerate(product_ids)}
    products = [by_id[pid] for pid in product_ids if pid in by_id]
    if sponsored_first:
        products.sort(key=lambda p: (not p.is_sponsored, position[p.id]))
    total = len(products)
    if limit is not None:
        products = products[:limit]
    return products, total


def _category_strip(section, request):
    categories = list(Category.objects.filter(parent__isnull=True, is_active=True))
    if not categories:
        return None
    return {'categories': CategoryTileSerializer(categories, many=True, context={'request': request}).data}


def _banners(section, request):
    banners = list(
        section.banners.filter(is_active=True).select_related('target_category', 'target_product', 'target_collection')
    )
    if not banners:
        return None
    return {'banners': BannerSerializer(banners, many=True, context={'request': request}).data}


def _deal(section, request):
    deal = Deal.current()
    if deal is None:
        return None
    ids = list(deal.items.order_by('sort_order', 'id').values_list('product_id', flat=True))
    products, _ = _cards_in_order(ids, request, limit=section.item_limit)
    if not products:
        return None
    seconds_left = max(int((deal.ends_at - timezone.now()).total_seconds()), 0)
    payload = {'id': deal.id, 'name': deal.name, 'ends_at': deal.ends_at, 'seconds_left': seconds_left, 'products': products}
    return {'deal': DealSerializer(payload, context={'request': request}).data}


def _product_row(section, request):
    collection = section.collection
    if collection is None or not collection.is_active:
        return None
    ids = list(collection.items.order_by('sort_order', 'id').values_list('product_id', flat=True))
    products, total = _cards_in_order(ids, request, limit=section.item_limit, sponsored_first=True)
    if not products:
        return None
    return {
        'collection': {'slug': collection.slug, 'name': collection.name},
        'products': ProductCardSerializer(products, many=True, context={'request': request}).data,
        'has_more': total > len(products),
    }


_BUILDERS = {
    HomeSection.Kind.CATEGORY_STRIP: _category_strip,
    HomeSection.Kind.BANNER_CAROUSEL: _banners,
    HomeSection.Kind.MID_BANNER: _banners,
    HomeSection.Kind.DEAL_OF_DAY: _deal,
    HomeSection.Kind.PRODUCT_ROW: _product_row,
}


def build_home(request):
    sections = []
    for section in HomeSection.objects.filter(is_active=True).select_related('collection'):
        content = _BUILDERS[section.kind](section, request)
        if content is None:
            continue
        sections.append({'id': section.id, 'kind': section.kind, 'title': section.title, **content})
    # The moving line under the pincode bar: the messages that are live right now, in the admin's order.
    ticker = AnnouncementSettings.load()
    announcements = list(Announcement.live().values_list('text', flat=True)) if ticker.is_enabled else []
    return {'announcements': announcements, 'announcement_speed': ticker.speed, 'sections': sections}
