"""Builds the Product detail page: everything the app needs for one product, in one call."""

from decimal import Decimal

from django.db.models import Count

from .models import Bundle, Product, ProductQuestion, Review
from .queries import card_queryset
from .serializers import ProductCardSerializer, file_url, money

LOW_STOCK_AT = 5  # "Only 3 left" is shown when this few remain
PREVIEW_REVIEWS = 3
PREVIEW_QUESTIONS = 5
SIMILAR_LIMIT = 8


def stock_message(stock):
    if stock <= 0:
        return 'Out of stock'
    if stock <= LOW_STOCK_AT:
        return f'Only {stock} left'
    return 'In stock'


def get_product_or_none(slug):
    """A product that can be shown (active, in an active category, with an active variant), or None."""
    return card_queryset().select_related('category__parent').filter(slug=slug).first()


def review_dict(review):
    """One review as the app shows it. Real reviews come from buyers of a delivered order ("verified")."""
    if review.user_id:
        name = (review.user.name or '').strip().split(' ')[0] or 'Customer'
    else:
        name = review.reviewer_name.strip() or 'Customer'
    return {
        'id': review.id,
        'name': name,
        'rating': review.rating,
        'title': review.title,
        'body': review.body,
        'verified_purchase': review.order_item_id is not None,
        'created_at': review.created_at,
    }


def visible_reviews(product):
    return Review.objects.filter(product=product, is_visible=True).select_related('user')


def _rating_breakdown(product):
    counts = dict(
        Review.objects.filter(product=product, is_visible=True).values_list('rating').annotate(n=Count('id')).order_by()
    )
    return {str(star): counts.get(star, 0) for star in (5, 4, 3, 2, 1)}


def _bundles(product, request):
    """'Buy these together to save': active bundles that include this product and can be bought right now."""
    result = []
    bundles = (
        Bundle.objects.filter(is_active=True, items__variant__product=product)
        .distinct()
        .prefetch_related('items__variant__product__images', 'items__variant__colour', 'items__variant__size')
    )
    for bundle in bundles:
        items = list(bundle.items.all())
        if any((not i.variant.is_active) or (not i.variant.product.is_active) or i.variant.stock < i.quantity for i in items):
            continue
        total = sum((i.variant.price * i.quantity for i in items), Decimal('0'))
        saving = total - bundle.bundle_price
        if saving <= 0:
            continue
        rows = []
        for item in items:
            v = item.variant
            image = next(iter(v.product.images.all()), None)
            label = ' / '.join(x.name for x in (v.colour, v.size) if x)
            rows.append({
                'variant_id': v.id,
                'product_slug': v.product.slug,
                'name': v.product.name,
                'label': label,
                'image': file_url(request, image.image) if image else None,
                'image_alt': image.alt_text if image else '',
                'price': money(v.price),
                'quantity': item.quantity,
            })
        result.append({
            'id': bundle.id,
            'name': bundle.name,
            'items': rows,
            'bundle_price': money(bundle.bundle_price),
            'total_price': money(total),
            'saving': money(saving),
            'saving_percent': int((saving / total * Decimal(100)).quantize(Decimal('1'))),
        })
    return result


def _similar(product, request):
    """Other products in the same sub-category first, then others in the same main category."""
    picked = list(card_queryset().filter(category=product.category).exclude(pk=product.pk)[:SIMILAR_LIMIT])
    if len(picked) < SIMILAR_LIMIT:
        main = product.category.parent or product.category
        more = (
            card_queryset()
            .filter(category__parent=main)
            .exclude(pk__in=[product.pk] + [p.pk for p in picked])[: SIMILAR_LIMIT - len(picked)]
        )
        picked += list(more)
    return ProductCardSerializer(picked, many=True, context={'request': request}).data


def build_detail(product, request):
    variants = list(product.variants.filter(is_active=True).select_related('colour', 'size'))
    in_stock = [v for v in variants if v.stock > 0]
    default = min(in_stock or variants, key=lambda v: (v.price, v.id))

    colours, sizes = {}, {}
    for v in variants:
        if v.colour_id:
            colours.setdefault(v.colour_id, {'id': v.colour_id, 'name': v.colour.name, 'hex': v.colour.hex_code})
        if v.size_id:
            sizes.setdefault(v.size_id, {'id': v.size_id, 'name': v.size.name, 'sort_order': v.size.sort_order})

    category = product.category
    reviews = visible_reviews(product)
    questions = [q for q in ProductQuestion.objects.filter(product=product).exclude(answer='')[:PREVIEW_QUESTIONS]]
    avg = getattr(product, 'avg_rating', None)

    return {
        'id': product.id,
        'slug': product.slug,
        'name': product.name,
        'brand': {'name': product.brand.name, 'slug': product.brand.slug} if product.brand_id else None,
        'category': {
            'name': category.name,
            'slug': category.slug,
            'parent': {'name': category.parent.name, 'slug': category.parent.slug} if category.parent_id else None,
        },
        'description': product.description,
        'video_url': product.video_url,
        'is_sponsored': product.is_sponsored,
        'rating': round(float(avg), 1) if avg is not None else None,
        'rating_count': getattr(product, 'review_count', 0) or 0,
        'rating_breakdown': _rating_breakdown(product),
        'images': [
            {'id': i.id, 'url': file_url(request, i.image), 'alt': i.alt_text, 'colour_id': i.colour_id}
            for i in product.card_images
        ],
        'colours': list(colours.values()),
        'sizes': sorted(sizes.values(), key=lambda s: (s['sort_order'], s['name'])),
        'variants': [
            {
                'id': v.id,
                'sku': v.sku,
                'colour_id': v.colour_id,
                'size_id': v.size_id,
                'price': money(v.price),
                'mrp': money(v.mrp),
                'discount_percent': v.discount_percent,
                'stock': v.stock,
                'in_stock': v.stock > 0,
                'stock_message': stock_message(v.stock),
            }
            for v in variants
        ],
        'default_variant_id': default.id,
        'specifications': [{'name': s.name, 'value': s.value} for s in product.specifications.all()],
        'reviews': [review_dict(r) for r in reviews[:PREVIEW_REVIEWS]],
        'questions': [{'id': q.id, 'question': q.question, 'answer': q.answer} for q in questions],
        'bundles': _bundles(product, request),
        'similar': _similar(product, request),
    }
