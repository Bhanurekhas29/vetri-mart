"""Emails about an order after it is confirmed: shipped, delivered, cancelled and refunded.
(The "order confirmed" email is sent by checkout.py when the payment is verified.)

They follow the shopper's own setting "email me about my orders" and never block anything: a broken mail setup is only
logged. Until real email sending is set up in the admin, emails are printed in the backend window.
"""

import logging

from django.core.mail import send_mail

from .models import Order, Payment

logger = logging.getLogger(__name__)


def _inr(amount):
    return f'Rs {amount:,.2f}'


def _send(order, subject, text):
    user = order.user
    if not user.email_order_updates:
        return
    body = f'Hi {user.name},\n\n{text}\n\nYou can see the details in the Vetri Mart app under Orders.\n\nVetri Mart'
    send_mail(subject, body, None, [user.email], fail_silently=False)


def send_status_email(order_id, status):
    try:
        order = Order.objects.select_related('user').get(pk=order_id)
        number = order.order_number
        if status == Order.Status.SHIPPED:
            via = ' / '.join(x for x in (order.courier_name, f'tracking number {order.tracking_number}' if order.tracking_number else '') if x)
            _send(order, f'Order {number} has shipped', f'Good news: your order {number} is on its way.' + (f'\nCourier: {via}' if via else ''))
        elif status == Order.Status.DELIVERED:
            _send(order, f'Order {number} delivered', f'Your order {number} has been delivered. We hope you like it!\nYou can now rate and review what you bought.')
        elif status == Order.Status.CANCELLED:
            paid = order.payments.filter(status=Payment.Status.PAID).exists()
            refund = f'\nWe received your payment of {_inr(order.total_amount)}, and it will be refunded to your original payment method.' if paid else ''
            _send(order, f'Order {number} cancelled', f'Your order {number} has been cancelled.{refund}')
    except Exception:
        logger.exception('Could not send the %s email for order %s', status, order_id)


def send_refund_email(payment_id):
    try:
        payment = Payment.objects.select_related('order__user').get(pk=payment_id)
        order = payment.order
        _send(order, f'Refund for order {order.order_number}', f'We have refunded {_inr(payment.amount)} for your order {order.order_number}.\nIt can take a few working days to show in your account.')
    except Exception:
        logger.exception('Could not send the refund email for payment %s', payment_id)
