"""Reusable product queries, so every screen loads product cards the same way (and quickly)."""

from django.db.models import Avg, Count, Exists, OuterRef, Prefetch, Q

from .models import Product, ProductImage, ProductVariant


def card_queryset():
    """Products that can be shown on a card: active, in an active category, with at least one active variant.

    Everything a card needs is loaded in a fixed handful of queries, however many products there are:
    the brand (joined), the active variants and the images (one query each), and the rating (calculated).
    """
    has_active_variant = Exists(ProductVariant.objects.filter(product=OuterRef('pk'), is_active=True))
    visible_review = Q(reviews__is_visible=True)
    return (
        Product.objects.filter(is_active=True, category__is_active=True)
        .filter(has_active_variant)
        .select_related('brand')
        .prefetch_related(
            Prefetch('variants', queryset=ProductVariant.objects.filter(is_active=True), to_attr='active_variants'),
            Prefetch('images', queryset=ProductImage.objects.order_by('sort_order', 'id'), to_attr='card_images'),
        )
        .annotate(
            avg_rating=Avg('reviews__rating', filter=visible_review),
            review_count=Count('reviews', filter=visible_review, distinct=True),
        )
    )
