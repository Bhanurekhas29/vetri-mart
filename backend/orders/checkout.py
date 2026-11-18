"""Checkout: what the shopper sees before paying, creating the order, and confirming the payment.

The order is created as "Pending payment". Stock is reduced, and the order becomes Confirmed, only once Razorpay's
signature has been checked on the server. A failed or abandoned payment can be retried from the same order.
Everything the order shows later (name, price, address) is a copy taken now, so later edits never change it.
"""

import logging
from decimal import Decimal

from django.core.mail import send_mail
from django.db import transaction

from accounts.exceptions import ApiError
from accounts.models import Address
from catalog.models import ProductVariant
from catalog.serializers import file_url, money

from . import payments
from .cart import build_cart, cart_queryset, delivery_fee_for, variant_picture
from . import invoice
from siteconfig.email_layout import branded_email

from .emails import run_in_background
from .models import REPLACED_NOTE, CartCoupon, CartItem, Coupon, Order, OrderItem, OrderStatusEvent, Payment, ServiceablePincode

logger = logging.getLogger(__name__)
ZERO = Decimal('0.00')


# ---------- the address and delivery estimate ----------

def address_dict(address):
    return {
        'id': address.id,
        'recipient_name': address.recipient_name,
        'phone': address.phone,
        'pincode': address.pincode,
        'address_line1': address.address_line1,
        'address_line2': address.address_line2,
        'landmark': address.landmark,
        'city': address.city,
        'state': address.state,
        'label': address.label,
        'is_default': address.is_default,
    }


def delivery_estimate(pincode):
    row = ServiceablePincode.objects.filter(pincode=pincode, is_active=True).first()
    if row is None:
        return {'deliverable': False, 'days_min': None, 'days_max': None, 'message': 'Sorry, we do not deliver to this pincode yet.'}
    if row.delivery_days_min == row.delivery_days_max:
        message = f'Delivery in {row.delivery_days_min} days'
    else:
        message = f'Delivery in {row.delivery_days_min} to {row.delivery_days_max} days'
    return {'deliverable': True, 'days_min': row.delivery_days_min, 'days_max': row.delivery_days_max, 'message': message}


def pick_address(user, address_id=None):
    """The chosen address, else the default one, else the newest. Deleted addresses never count."""
    addresses = Address.objects.filter(user=user, is_deleted=False)
    if address_id:
        return addresses.filter(pk=address_id).first()
    return addresses.filter(is_default=True).first() or addresses.order_by('-id').first()


# ---------- before paying ----------

def checkout_summary(user, request, address_id=None):
    cart = build_cart(user, request)
    address = pick_address(user, address_id)
    delivery = delivery_estimate(address.pincode) if address else None
    ready = payments.payments_ready()

    blockers = []
    if not cart['items']:
        blockers.append('Your cart is empty.')
    elif not cart['can_checkout']:
        blockers.append('Some items in your cart need attention. Please fix them in your cart.')
    if address is None:
        blockers.append('Add a delivery address.')
    elif not delivery['deliverable']:
        blockers.append(delivery['message'])
    if not ready:
        blockers.append('Payments are not set up yet. Please try again later.')

    return {
        'items': [
            {'name': i['name'], 'label': i['label'], 'image': i['image'], 'image_alt': i['image_alt'], 'quantity': i['quantity']}
            for i in cart['items']
        ],
        'summary': cart['summary'],
        'bundles': cart['bundles'],
        'coupon': cart['coupon'],
        'address': address_dict(address) if address else None,
        'delivery': delivery,
        'payments_ready': ready,
        'can_pay': not blockers,
        'blockers': blockers,
    }


# ---------- creating the order ----------

def _razorpay_block(order, payment, user):
    """What the app needs to open Razorpay's payment page. The secret key never leaves the server."""
    key_id, _ = payments.keys()
    return {
        'key_id': key_id,
        'razorpay_order_id': payment.razorpay_order_id,
        'amount_paise': payments.to_paise(payment.amount),
        'currency': 'INR',
        'description': f'Order {order.order_number}',
        'prefill': {'name': user.name, 'email': user.email, 'contact': f'+91{order.phone}'},  # with the country code, as Razorpay recommends
    }


def _start_payment(order):
    """Creates the Razorpay order and our payment row for it."""
    remote = payments.create_razorpay_order(order.total_amount, order.order_number)
    return Payment.objects.create(order=order, razorpay_order_id=remote['id'], amount=order.total_amount)


@transaction.atomic
def create_order(user, address_id, request):
    address = pick_address(user, address_id) if address_id else None
    if address is None:
        raise ApiError('address_required', 'Choose a delivery address.', 400)
    estimate = delivery_estimate(address.pincode)
    if not estimate['deliverable']:
        raise ApiError('not_deliverable', estimate['message'], 400)
    payments.keys()  # fails early with a clear message if payments are not set up

    cart = build_cart(user, request)
    if not cart['items']:
        raise ApiError('cart_empty', 'Your cart is empty.', 400)
    if not cart['can_checkout']:
        raise ApiError('cart_needs_attention', 'Some items in your cart are out of stock or no longer available.', 400)

    lines = list(cart_queryset(user).filter(saved_for_later=False))
    # The cart has already worked out everything (bundle savings, coupon, delivery fee, total): the order copies those numbers.
    totals = cart['summary']
    bundle_discount = Decimal(totals['bundle_savings'])
    fee = Decimal(totals['delivery_fee'])
    total = Decimal(totals['total'])
    coupon = None
    coupon_discount = ZERO
    if cart['coupon'] and cart['coupon']['valid']:
        coupon = Coupon.objects.get(code=cart['coupon']['code'])
        coupon_discount = Decimal(cart['coupon']['discount'])

    # An earlier unpaid order from this cart is replaced, so the Orders list is not cluttered with abandoned tries.
    for old in Order.objects.filter(user=user, status=Order.Status.PENDING_PAYMENT):
        old.status = Order.Status.CANCELLED
        old.save(update_fields=['status', 'updated_at'])
        old.record_status(note=REPLACED_NOTE)

    order = Order.objects.create(
        user=user,
        recipient_name=address.recipient_name, phone=address.phone, pincode=address.pincode,
        address_line1=address.address_line1, address_line2=address.address_line2, landmark=address.landmark,
        city=address.city, state=address.state,
        coupon=coupon, coupon_code=coupon.code if coupon else '', coupon_discount=coupon_discount, bundle_discount=bundle_discount,
        delivery_fee=fee, total_amount=total,
    )
    for line in lines:
        v = line.variant
        picture = variant_picture(v)
        OrderItem.objects.create(
            order=order, variant=v, product_name=v.product.name,
            colour=v.colour.name if v.colour_id else '', size=v.size.name if v.size_id else '', sku=v.sku,
            image_url=picture.image.url if picture else '',  # kept as a path: the app adds the server address when showing it
            price=v.price, mrp=v.mrp, quantity=line.quantity,
        )
    order.record_status()
    payment = _start_payment(order)
    return order, _razorpay_block(order, payment, user)


@transaction.atomic
def retry_payment(user, order_id):
    order = Order.objects.select_for_update().filter(pk=order_id, user=user).first()
    if order is None:
        raise ApiError('not_found', 'That order does not exist.', 404)
    if order.status != Order.Status.PENDING_PAYMENT:
        raise ApiError('not_payable', 'This order is not waiting for payment.', 400)
    short = [i for i in order.items.select_related('variant') if not i.variant.is_active or i.variant.stock < i.quantity]
    if short:
        raise ApiError('cart_needs_attention', f'{short[0].product_name} is no longer available in that quantity.', 400)
    payment = _start_payment(order)
    return order, _razorpay_block(order, payment, user)


# ---------- after paying ----------

def mark_payment_failed(user, order_id, razorpay_order_id, reason):
    """The payment page reported a failure. Only an unpaid attempt of this shopper's own order can be marked."""
    payment = Payment.objects.filter(order_id=order_id, order__user=user, razorpay_order_id=razorpay_order_id).first()
    if payment is None:
        raise ApiError('not_found', 'That payment does not exist.', 404)
    if payment.status == Payment.Status.CREATED:
        payment.status = Payment.Status.FAILED
        payment.failure_reason = (reason or '')[:200]
        payment.save(update_fields=['status', 'failure_reason'])


@transaction.atomic
def confirm_payment(user, order_id, razorpay_order_id, razorpay_payment_id, signature):
    """Checks Razorpay's signature, then confirms the order and reduces the stock. Safe to repeat.

    Returns (order, outcome): 'confirmed', 'already' (asked twice), 'sold_out' (the money is kept for a refund) or
    'cancelled' (paid after the order was cancelled). The outcomes are returned, not raised, on purpose: raising
    inside this transaction would undo the record that the money arrived."""
    order = Order.objects.select_for_update().filter(pk=order_id, user=user).first()
    payment = Payment.objects.select_for_update().filter(order=order, razorpay_order_id=razorpay_order_id).first() if order else None
    if order is None or payment is None:
        raise ApiError('not_found', 'That payment does not exist.', 404)
    if not payments.signature_is_valid(razorpay_order_id, razorpay_payment_id, signature):
        raise ApiError('invalid_signature', 'We could not verify this payment. If money was taken, it will be refunded.', 400)

    if payment.status == Payment.Status.PAID:
        return order, 'already'  # already confirmed (the app asked twice)
    if order.status != Order.Status.PENDING_PAYMENT:
        # paid after the order was cancelled: keep the money record so the admin can refund it
        payment.razorpay_payment_id = razorpay_payment_id
        payment.status = Payment.Status.PAID
        payment.save(update_fields=['razorpay_payment_id', 'status'])
        return order, 'cancelled'

    payment.razorpay_payment_id = razorpay_payment_id
    payment.method = payments.payment_method(razorpay_payment_id)
    payment.status = Payment.Status.PAID
    payment.save()

    items = list(order.items.all())
    variants = {v.id: v for v in ProductVariant.objects.select_for_update().filter(pk__in=[i.variant_id for i in items])}
    short = [i for i in items if not variants[i.variant_id].is_active or variants[i.variant_id].stock < i.quantity]
    if short:
        # someone else bought the last ones while this shopper was paying: the money is kept for the admin to refund
        order.status = Order.Status.CANCELLED
        order.save(update_fields=['status', 'updated_at'])
        order.record_status(note='Out of stock after payment: refund needed')
        return order, 'sold_out'

    for item in items:
        variant = variants[item.variant_id]
        variant.stock -= item.quantity
        variant.save(update_fields=['stock'])
    order.status = Order.Status.CONFIRMED
    order.save(update_fields=['status', 'updated_at'])
    order.record_status()
    CartItem.objects.filter(user=user, variant_id__in=[i.variant_id for i in items], saved_for_later=False).delete()
    CartCoupon.objects.filter(user=user).delete()  # the coupon was used by this order
    transaction.on_commit(lambda: run_in_background(send_order_confirmation, order.pk))
    return order, 'confirmed'


def send_order_confirmation(order_id):
    """The confirmation email (printed in the backend window until real email sending is set up). Never blocks an order."""
    try:
        order = Order.objects.select_related('user').get(pk=order_id)
        if not order.user.email_order_updates:
            return
        items = list(order.items.all())
        lines = [f'  {i.quantity} x {i.product_name}' + (f' ({i.colour}{" / " + i.size if i.size else ""})' if i.colour or i.size else '') + f' - Rs {i.price * i.quantity:,.2f}' for i in items]
        estimate = delivery_estimate(order.pincode)
        where = f'{order.recipient_name}, {order.address_line1}, {order.city} {order.pincode}'
        body = (
            f'Hi {order.user.name},\n\nThank you for your order. We received your payment of Rs {order.total_amount:,.2f}.\n\n'
            f'Order number: {order.order_number}\n\nItems:\n' + '\n'.join(lines) + '\n\n'
            f'Delivery to: {where}\n'
            f'{estimate["message"] if estimate["deliverable"] else ""}\n\n'
            'You can follow your order in the Vetri Mart app under Orders.\n\nVetri Mart'
        )
        html = branded_email(
            'Thank you for your order!',
            [f'Hi {order.user.name}, we received your payment of Rs {order.total_amount:,.2f}.', f'Order number: {order.order_number}'],
            table=[
                (f'{i.quantity} x {i.product_name}' + (f' ({i.colour}{" / " + i.size if i.size else ""})' if i.colour or i.size else ''), f'Rs {i.price * i.quantity:,.2f}')
                for i in items
            ],
            total=('Total paid', f'Rs {order.total_amount:,.2f}'),
            note=f'Delivery to: {where}. {estimate["message"] if estimate["deliverable"] else ""} You can follow your order in the Vetri Mart app under Orders.'.replace('  ', ' '),
        )
        send_mail(f'Order {order.order_number} confirmed', body, None, [order.user.email], fail_silently=False, html_message=html)
    except Exception:
        logger.exception('Could not send the order confirmation email for order %s', order_id)


# ---------- showing an order ----------

STEP_LABELS = {'placed': 'Order placed', 'confirmed': 'Confirmed', 'shipped': 'Shipped', 'delivered': 'Delivered', 'cancelled': 'Cancelled'}


def _timeline(order):
    reached = {}
    for event in order.events.all():
        key = 'placed' if event.status == Order.Status.PENDING_PAYMENT else event.status
        reached.setdefault(key, event.changed_at)
    reached.setdefault('placed', order.created_at)
    steps = []
    for key in ('placed', 'confirmed', 'shipped', 'delivered'):
        if order.status == Order.Status.CANCELLED and key not in reached:
            continue  # a cancelled order shows only what really happened, then the cancellation
        at = reached.get(key)
        detail = ''
        if key == 'shipped' and at and (order.courier_name or order.tracking_number):
            detail = ' / '.join(x for x in (order.courier_name, f'Tracking {order.tracking_number}' if order.tracking_number else '') if x)
        steps.append({'key': key, 'label': STEP_LABELS[key], 'at': at, 'done': at is not None, 'detail': detail})
    if order.status == Order.Status.CANCELLED:
        steps.append({'key': 'cancelled', 'label': STEP_LABELS['cancelled'], 'at': reached.get('cancelled'), 'done': True, 'detail': ''})
    return steps


def order_dict(order, request):
    from catalog.models import Review

    items = list(order.items.all())
    delivered = order.status == Order.Status.DELIVERED
    reviews = {r.product_id: r for r in Review.objects.filter(user=order.user, product_id__in=[i.variant.product_id for i in items])}
    paid = order.payments.filter(status__in=[Payment.Status.PAID, Payment.Status.REFUNDED]).order_by('-created_at').first()
    is_refunded = order.payments.filter(status=Payment.Status.REFUNDED).exists()
    cancelled = order.status == Order.Status.CANCELLED
    mrp_total = sum((i.mrp * i.quantity for i in items), ZERO)
    price_total = sum((i.price * i.quantity for i in items), ZERO)
    estimate = delivery_estimate(order.pincode)
    return {
        'id': order.id,
        'order_number': order.order_number,
        'status': order.status,
        'status_label': order.get_status_display(),
        'created_at': order.created_at,
        'items': [
            {
                'name': i.product_name, 'colour': i.colour, 'size': i.size, 'sku': i.sku,
                'image': (request.build_absolute_uri(i.image_url) if i.image_url.startswith('/') else i.image_url) or None,
                'price': money(i.price), 'mrp': money(i.mrp), 'quantity': i.quantity, 'line_total': money(i.price * i.quantity),
                'product_slug': i.variant.product.slug,
                'can_review': delivered,  # a delivered item can be reviewed (or its review edited)
                'review': {'id': reviews[i.variant.product_id].id, 'rating': reviews[i.variant.product_id].rating} if i.variant.product_id in reviews else None,
            }
            for i in items
        ],
        'address': {
            'recipient_name': order.recipient_name, 'phone': order.phone, 'pincode': order.pincode,
            'address_line1': order.address_line1, 'address_line2': order.address_line2, 'landmark': order.landmark,
            'city': order.city, 'state': order.state,
        },
        'price': {
            'mrp_total': money(mrp_total),
            'product_discount': money(mrp_total - price_total),
            'subtotal': money(price_total),
            'bundle_discount': money(order.bundle_discount),
            'coupon_code': order.coupon_code,
            'coupon_discount': money(order.coupon_discount),
            'delivery_fee': money(order.delivery_fee),
            'total': money(order.total_amount),
        },
        'timeline': _timeline(order),
        'courier_name': order.courier_name,
        'tracking_number': order.tracking_number,
        'payment': {'status': paid.status if paid else None, 'method': paid.get_method_display() if paid and paid.method else ''},
        'delivery_estimate': estimate['message'] if estimate['deliverable'] else '',
        'is_refunded': is_refunded,
        'refund_pending': cancelled and paid is not None and not is_refunded,
        'can_pay': order.status == Order.Status.PENDING_PAYMENT,
        'can_cancel': order.status in (Order.Status.PENDING_PAYMENT, Order.Status.CONFIRMED),
        'can_review': delivered,
        'can_invoice': invoice.can_invoice(order),
    }


ACTIVE_STATUSES = (Order.Status.PENDING_PAYMENT, Order.Status.CONFIRMED, Order.Status.SHIPPED)
CANCELLED_BY_CUSTOMER = 'Cancelled by customer'


def order_card(order, request, reviewed_product_ids=frozenset()):
    """The small version of an order for the My Orders list."""
    items = list(order.items.all())
    first = items[0] if items else None
    paid = any(p.status in (Payment.Status.PAID, Payment.Status.REFUNDED) for p in order.payments.all())
    refunded = any(p.status == Payment.Status.REFUNDED for p in order.payments.all())
    return {
        'id': order.id,
        'order_number': order.order_number,
        'status': order.status,
        'status_label': order.get_status_display(),
        'created_at': order.created_at,
        'total': money(order.total_amount),
        'first_item': first.product_name if first else '',
        'more_items': max(len(items) - 1, 0),
        'image': ((request.build_absolute_uri(first.image_url) if first.image_url.startswith('/') else first.image_url) or None) if first else None,
        'can_pay': order.status == Order.Status.PENDING_PAYMENT,
        # "Rate and review" is offered while at least one item of a delivered order has no review yet
        'can_review': order.status == Order.Status.DELIVERED and any(i.variant.product_id not in reviewed_product_ids for i in items),
        'refund_pending': order.status == Order.Status.CANCELLED and paid and not refunded,
        'is_refunded': refunded,
    }


@transaction.atomic
def cancel_order(user, order_id):
    """The shopper cancels while the order is Pending payment or Confirmed. Reduced stock goes back on the shelf.
    After Shipped they must contact support. Cancelling twice is harmless."""
    order = Order.objects.select_for_update().filter(pk=order_id, user=user).first()
    if order is None:
        raise ApiError('not_found', 'That order does not exist.', 404)
    if order.status == Order.Status.CANCELLED:
        return order
    if order.status not in (Order.Status.PENDING_PAYMENT, Order.Status.CONFIRMED):
        raise ApiError('not_cancellable', 'This order has already been shipped, so it cannot be cancelled here. Please contact support.', 400)

    if order.status == Order.Status.CONFIRMED:
        items = list(order.items.all())
        variants = {v.id: v for v in ProductVariant.objects.select_for_update().filter(pk__in=[i.variant_id for i in items])}
        for item in items:
            variant = variants[item.variant_id]
            variant.stock += item.quantity
            variant.save(update_fields=['stock'])
    order.status = Order.Status.CANCELLED
    order.save(update_fields=['status', 'updated_at'])
    order.record_status(note=CANCELLED_BY_CUSTOMER)
    return order
