"""The money rules of the cart that go beyond "price x quantity": bundle savings and coupons.

Order of the arithmetic (all amounts in rupees):

    Price (what the shopper pays per item)                         = sum of price x quantity
    - Bundle savings (automatic, see below)                        = "items total"
    Delivery fee: judged on the items total, BEFORE any coupon      (a coupon never makes delivery start costing money)
    - Coupon (one per order, taken off the items total)
    Total to pay = items total - coupon + delivery fee

Bundles: whenever every item of an active bundle is in the cart (in at least the bundle's quantities) the saving of that
bundle is applied, once for each complete set, however the items got into the cart. Bundles that share an item are
applied best saving first, and each unit is used by only one bundle.

Coupons: percent or flat, with an optional cap, minimum order, start and end time and total usage limit. A shopper can use
a code once (orders they cancelled do not count); a code stops when its usage limit is reached. The discount always
leaves at least Rs 1 to pay, so a payment is always possible.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from catalog.models import Bundle

from .models import Coupon, Order

ZERO = Decimal('0')
PAID_STATUSES = (Order.Status.CONFIRMED, Order.Status.SHIPPED, Order.Status.DELIVERED)
MIN_PAYABLE = Decimal('1')


def _round(value):
    return Decimal(value).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _rupees(value):
    return f'₹{Decimal(value):,.0f}'


# ---------------------------------------------------------------- bundles ----

def usable_bundles():
    """Active bundles whose items are all still on sale and which really save money, best saving first.
    Returns a list of (saving per set, bundle, items)."""
    found = []
    bundles = Bundle.objects.filter(is_active=True).prefetch_related(
        'items__variant__product__images', 'items__variant__product__brand', 'items__variant__colour', 'items__variant__size'
    )
    for bundle in bundles:
        items = list(bundle.items.all())
        if not items or any(not i.variant.is_active or not i.variant.product.is_active for i in items):
            continue
        saving = sum((i.variant.price * i.quantity for i in items), ZERO) - bundle.bundle_price
        if saving > 0:
            found.append((saving, bundle, items))
    found.sort(key=lambda c: (-c[0], c[1].id))
    return found


def apply_bundles(counted):
    """`counted` is {variant id: quantity in the cart}. Returns (applied bundles, total saving, what is left over, others)."""
    remaining = dict(counted)
    applied, total, others = [], ZERO, []
    for saving, bundle, items in usable_bundles():
        sets = min(remaining.get(i.variant_id, 0) // i.quantity for i in items)
        if sets <= 0:
            others.append((saving, bundle, items))
            continue
        for i in items:
            remaining[i.variant_id] -= sets * i.quantity
        applied.append({'id': bundle.id, 'name': bundle.name, 'sets': sets, 'saving_each': saving, 'saving': saving * sets})
        total += saving * sets
    return applied, total, remaining, others


# ---------------------------------------------------------------- coupons ----

def find_coupon(code):
    code = (code or '').strip().upper()
    return Coupon.objects.filter(code=code).first() if code else None


def _num(value):
    value = Decimal(value)
    return f'{value:,.0f}' if value == value.to_integral_value() else f'{value:,.2f}'


def describe_coupon(coupon):
    """What the coupon gives, in words, for example "10% off up to ₹100 on orders above ₹299"."""
    if coupon.kind == Coupon.Kind.PERCENT:
        text = f'{_num(coupon.value)}% off'
        if coupon.max_discount is not None:
            text += f' up to ₹{_num(coupon.max_discount)}'
    else:
        text = f'₹{_num(coupon.value)} off'
    if coupon.min_order_amount > 0:
        text += f' on orders above ₹{_num(coupon.min_order_amount)}'
    return text


def available_offers(user, base):
    """The coupons the shopper may see in the cart: active, ticked "show in app", inside their dates and not fully claimed.
    Logged in: ones they already used are left out, and each says whether it works for this cart and how much it saves.
    A guest (user is None) sees them all, with eligible = None (they have to log in first)."""
    now = timezone.now()
    offers = []
    for coupon in Coupon.objects.filter(is_active=True, show_in_app=True, valid_from__lte=now, valid_until__gte=now).order_by('code'):
        paid = Order.objects.filter(coupon=coupon, status__in=PAID_STATUSES)
        if coupon.usage_limit is not None and paid.count() >= coupon.usage_limit:
            continue
        offer = {
            'code': coupon.code,
            'title': coupon.description.strip() or describe_coupon(coupon),
            'detail': describe_coupon(coupon),
            'min_order_amount': str(coupon.min_order_amount),
            'valid_until': coupon.valid_until.isoformat(),
            'eligible': None,
            'reason': '',
            'discount': None,
        }
        if user is not None:
            if paid.filter(user=user).exists():
                continue  # already used: no point showing it
            discount, error, message = check_coupon(coupon, user, base)
            offer['eligible'] = error is None
            offer['reason'] = message
            offer['discount'] = str(discount) if error is None else None
        offers.append(offer)
    offers.sort(key=lambda o: (o['eligible'] is False, -Decimal(o['discount'] or 0), o['code']))
    return offers


def check_coupon(coupon, user, base):
    """Can this shopper use this coupon on an items total of `base`?
    Returns (discount, error code, message): the discount is 0 and the code and message are set when it cannot be used."""
    now = timezone.now()
    if not coupon.is_active:
        return ZERO, 'coupon_invalid', 'That coupon code is not valid.'
    if now < coupon.valid_from:
        return ZERO, 'coupon_not_started', 'This coupon is not active yet.'
    if now > coupon.valid_until:
        return ZERO, 'coupon_expired', 'This coupon has expired.'
    if base < coupon.min_order_amount:
        return ZERO, 'coupon_min_order', f'Add {_rupees(coupon.min_order_amount - base)} more to use this coupon (minimum order {_rupees(coupon.min_order_amount)}).'
    paid_with_it = Order.objects.filter(coupon=coupon, status__in=PAID_STATUSES)
    if coupon.usage_limit is not None and paid_with_it.count() >= coupon.usage_limit:
        return ZERO, 'coupon_limit', 'This coupon has been fully claimed.'
    if paid_with_it.filter(user=user).exists():
        return ZERO, 'coupon_used', 'You have already used this coupon.'

    if coupon.kind == Coupon.Kind.PERCENT:
        discount = base * coupon.value / Decimal(100)
        if coupon.max_discount is not None:
            discount = min(discount, coupon.max_discount)
    else:
        discount = coupon.value
    discount = _round(min(discount, base - MIN_PAYABLE))  # always leave something to pay
    if discount <= 0:
        return ZERO, 'coupon_invalid', 'This coupon does not apply to your cart.'
    return discount, None, ''
