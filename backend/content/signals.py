"""Automatic notifications: one when an order changes status, one when a payment fails or is refunded."""

from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from orders.emails import run_in_background, send_refund_email, send_status_email
from orders.models import REPLACED_NOTE, OrderStatusEvent, Payment

from .models import Notification


def _inr(amount):
    return f'₹{amount:,.2f}'.replace('.00', '')


@receiver(post_save, sender=OrderStatusEvent)
def notify_order_status(sender, instance, created, **kwargs):
    if not created or instance.note == REPLACED_NOTE:
        return
    order = instance.order
    status = instance.status
    if status == 'confirmed':
        title, msg = 'Order confirmed', f'We received your payment of {_inr(order.total_amount)} for order {order.order_number}.'
    elif status == 'shipped':
        via = f' with {order.courier_name}' if order.courier_name else ''
        title, msg = 'Your order has shipped', f'Order {order.order_number} is on its way{via}.'
    elif status == 'delivered':
        title, msg = 'Order delivered', f'Order {order.order_number} has been delivered. You can now rate your purchase.'
    elif status == 'cancelled':
        title, msg = 'Order cancelled', f'Order {order.order_number} was cancelled.'
    else:
        return  # pending payment: nothing to tell the customer yet
    Notification.objects.create(user=order.user, kind=Notification.Kind.ORDER, title=title, message=msg, order=order)
    if status in ('shipped', 'delivered', 'cancelled'):
        transaction.on_commit(lambda: run_in_background(send_status_email, order.pk, status))  # the shopper's email setting is respected inside


@receiver(pre_save, sender=Payment)
def remember_payment_status(sender, instance, **kwargs):
    old = None
    if instance.pk:
        old = Payment.objects.filter(pk=instance.pk).values_list('status', flat=True).first()
    instance._old_status = old


@receiver(post_save, sender=Payment)
def notify_payment(sender, instance, created, **kwargs):
    if instance.status == getattr(instance, '_old_status', None):
        return
    order = instance.order
    if instance.status == Payment.Status.FAILED:
        title, msg = 'Payment failed', f'Your payment for order {order.order_number} did not go through. You can try again.'
    elif instance.status == Payment.Status.REFUNDED:
        title, msg = 'Refund processed', f'We refunded {_inr(instance.amount)} for order {order.order_number}.'
    else:
        return
    Notification.objects.create(user=order.user, kind=Notification.Kind.PAYMENT, title=title, message=msg, order=order)
    if instance.status == Payment.Status.REFUNDED:
        transaction.on_commit(lambda: run_in_background(send_refund_email, instance.pk))
