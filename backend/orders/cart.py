"""The shopper's cart: what is in it, what each line costs today, and whether it can be ordered.

A logged-in shopper's cart is stored here. A guest's cart lives on the phone and is priced by `build_guest_cart`.

The cart always uses today's price. `price_when_added` is only used to say "Price dropped from X".
Quantity is limited only by the stock of that version.
"""

from decimal import Decimal
from types import SimpleNamespace

from catalog.detail import LOW_STOCK_AT, stock_message
from catalog.serializers import file_url, money

from catalog.models import ProductVariant

from . import pricing
from .models import CartCoupon, CartItem, DeliverySetting

ZERO = Decimal('0')


def _variant_is_buyable(variant):
    product = variant.product
    return variant.is_active and product.is_active and product.category.is_active


def variant_picture(variant):
    """The picture row for this version: its colour's picture if there is one, else a general one, else the first."""
    images = list(variant.product.images.all())
    return next((i for i in images if variant.colour_id and i.colour_id == variant.colour_id), None) or next(
        (i for i in images if i.colour_id is None), None
    ) or (images[0] if images else None)


def _picture(variant, request):
    chosen = variant_picture(variant)
    return (file_url(request, chosen.image), chosen.alt_text) if chosen else (None, '')


def delivery_fee_for(price_total, settings=None):
    """Flat fee, free from the free-delivery amount (both set in the admin's Delivery settings)."""
    settings = settings or DeliverySetting.load()
    if price_total == ZERO or price_total >= settings.free_delivery_above:
        return ZERO
    return settings.delivery_fee


def cart_queryset(user):
    return (
        CartItem.objects.filter(user=user)
        .select_related('variant__product__brand', 'variant__product__category', 'variant__colour', 'variant__size')
        .prefetch_related('variant__product__images')
        .order_by('-added_at', '-id')
    )


def build_cart(user, request):
    return _build(cart_queryset(user), request, user=user)


GUEST_MAX_LINES = 50


def guest_variants(variant_ids):
    return {
        v.id: v
        for v in ProductVariant.objects.filter(pk__in=variant_ids)
        .select_related('product__brand', 'product__category', 'colour', 'size')
        .prefetch_related('product__images')
    }


def build_guest_cart(lines, request):
    """Prices a cart that lives on the phone. `lines` is a list of (variant_id, quantity, saved_for_later).

    A guest line has no database row: its `id` is the variant's id. Versions that no longer exist are reported
    in `missing` so the phone can forget them."""
    found = guest_variants([vid for vid, _, _ in lines])
    objects = [
        SimpleNamespace(id=vid, variant=found[vid], quantity=qty, price_when_added=None, saved_for_later=saved)
        for vid, qty, saved in lines
        if vid in found
    ]
    cart = _build(objects, request)
    cart['missing'] = [vid for vid, _, _ in lines if vid not in found]
    return cart


def _build(lines, request, user=None):
    """Prices the lines. With a `user`, the coupon on their cart is applied too (guests have no coupon)."""
    items = []
    saved_items = []  # "Saved for later": shown below the cart, never in the totals or the count
    mrp_total = ZERO
    price_total = ZERO
    units = 0
    blocking = 0
    counted_qty = {}  # variant id -> quantity, for the lines that count (these decide the bundle savings)

    for line in lines:
        v = line.variant
        product = v.product
        buyable = _variant_is_buyable(v)
        in_stock = buyable and v.stock > 0
        qty = line.quantity

        if not buyable:
            issue = 'unavailable'
        elif v.stock <= 0:
            issue = 'out_of_stock'
        elif qty > v.stock:
            issue = 'low_stock'  # more in the cart than there is stock
        else:
            issue = None

        counted = in_stock and issue is None and not line.saved_for_later
        if counted:
            mrp_total += v.mrp * qty
            price_total += v.price * qty
            units += qty
            counted_qty[v.id] = counted_qty.get(v.id, 0) + qty
        elif not line.saved_for_later:
            blocking += 1

        image, alt = _picture(v, request)
        label = ' / '.join(x.name for x in (v.colour, v.size) if x)
        dropped = line.price_when_added and v.price < line.price_when_added
        (saved_items if line.saved_for_later else items).append({
            'id': line.id,
            'variant_id': v.id,
            'product_slug': product.slug,
            'name': product.name,
            'brand': product.brand.name if product.brand_id else None,
            'label': label,
            'image': image,
            'image_alt': alt or product.name,
            'quantity': qty,
            'price': money(v.price),
            'mrp': money(v.mrp),
            'discount_percent': v.discount_percent,
            'line_total': money(v.price * qty),
            'stock': v.stock if buyable else 0,
            'max_quantity': v.stock if buyable else 0,
            'stock_message': stock_message(v.stock) if buyable else 'No longer available',
            'low_stock': bool(buyable and 0 < v.stock <= LOW_STOCK_AT),
            'issue': issue,
            'price_dropped_from': money(line.price_when_added) if dropped else None,
            # when it was put in the cart (guests' carts live on the phone and have no time): the app uses it for the
            # "your cart is waiting" reminder
            'added_at': line.added_at.isoformat() if getattr(line, 'added_at', None) else None,
        })

    settings = DeliverySetting.load()

    # Bundle savings are automatic; the delivery fee is judged on the items total, before any coupon.
    applied, bundle_total, remaining, others = pricing.apply_bundles(counted_qty)
    items_total = price_total - bundle_total
    delivery_fee = delivery_fee_for(items_total, settings)

    coupon_info, coupon_discount = None, ZERO
    cart_coupon = CartCoupon.objects.filter(user=user).select_related('coupon').first() if user is not None else None
    if cart_coupon is not None:
        discount, code, message = pricing.check_coupon(cart_coupon.coupon, user, items_total)
        coupon_discount = discount
        coupon_info = {'code': cart_coupon.coupon.code, 'valid': code is None, 'discount': money(discount), 'message': message}

    total = items_total - coupon_discount + delivery_fee
    return {
        'items': items,
        'saved_items': saved_items,
        'count': sum(i['quantity'] for i in items),  # number on the cart icon: every unit in the cart
        'lines': len(items),
        'summary': {
            'units': units,
            'mrp_total': money(mrp_total),
            'discount': money(mrp_total - price_total),
            'subtotal': money(price_total),
            'bundle_savings': money(bundle_total),
            'items_total': money(items_total),
            'coupon_code': coupon_info['code'] if coupon_info and coupon_info['valid'] else '',
            'coupon_discount': money(coupon_discount),
            'delivery_fee': money(delivery_fee),
            'free_delivery_above': money(settings.free_delivery_above),
            'total': money(total),
            'you_save': money(mrp_total - price_total + bundle_total + coupon_discount),
        },
        'bundles': [{**b, 'saving_each': money(b['saving_each']), 'saving': money(b['saving'])} for b in applied],
        'bundle_suggestions': _bundle_suggestions(others, remaining, request),
        'coupon': coupon_info,
        # Place order is blocked while any line is out of stock, over stock or no longer sold, or the cart is empty.
        'can_checkout': units > 0 and blocking == 0,
        'blocking_lines': blocking,
    }


MAX_SUGGESTIONS = 2


def _bundle_suggestions(others, remaining, request):
    """"Add X to complete the combo and save Rs Y": bundles the cart has started but not finished, and that can be completed now."""
    suggestions = []
    for saving, bundle, items in others:
        if not any(remaining.get(i.variant_id, 0) > 0 for i in items):
            continue  # nothing of this bundle in the cart: not worth a nudge
        missing = []
        for i in items:
            need = max(i.quantity - remaining.get(i.variant_id, 0), 0)
            if need and (i.variant.stock < need):
                missing = None  # cannot be completed right now
                break
            if need:
                image, alt = _picture(i.variant, request)
                missing.append({
                    'variant_id': i.variant_id, 'name': i.variant.product.name,
                    'label': ' / '.join(x.name for x in (i.variant.colour, i.variant.size) if x),
                    'quantity': need, 'price': money(i.variant.price), 'image': image, 'image_alt': alt or i.variant.product.name,
                })
        if missing:
            suggestions.append({'bundle_id': bundle.id, 'name': bundle.name, 'saving': money(saving), 'missing': missing})
        if len(suggestions) == MAX_SUGGESTIONS:
            break
    return suggestions
