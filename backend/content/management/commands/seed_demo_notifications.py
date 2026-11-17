"""Adds a few sample notifications so the Notifications screen and the bell can be seen before orders exist.

By default they go to every customer account (not staff); use --email to pick one account.
Safe to run again: a notification that is already there (same title and message) is not added twice.
Real ones are written automatically when an order status or payment changes.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import User
from content.models import Notification

# kind, title, message, minutes ago, read?
SAMPLES = [
    (Notification.Kind.ORDER, 'Order delivered', 'Order VM-DEMO-1003 has been delivered. You can now rate your purchase.', 60 * 26, False),
    (Notification.Kind.ORDER, 'Your order has shipped', 'Order VM-DEMO-1003 is on its way with Demo Courier.', 60 * 50, False),
    (Notification.Kind.PAYMENT, 'Payment failed', 'Your payment for order VM-DEMO-1004 did not go through. You can try again.', 12, False),
    (Notification.Kind.ORDER, 'Order confirmed', 'We received your payment of \u20b91,099 for order VM-DEMO-1003.', 60 * 24 * 4, True),
]


class Command(BaseCommand):
    help = 'Add sample notifications for demo.'

    def add_arguments(self, parser):
        parser.add_argument('--email', help='Only this account.')

    def handle(self, *args, **options):
        users = User.objects.filter(is_staff=False, is_active=True)
        if options['email']:
            users = users.filter(email__iexact=options['email'])
            if not users.exists():
                raise CommandError('No customer account with that email.')
        added = 0
        now = timezone.now()
        for user in users:
            for kind, title, message, minutes, read in SAMPLES:
                if Notification.objects.filter(user=user, title=title, message=message).exists():
                    continue
                n = Notification.objects.create(user=user, kind=kind, title=title, message=message, is_read=read)
                Notification.objects.filter(pk=n.pk).update(created_at=now - timedelta(minutes=minutes))  # auto date, so set it after
                added += 1
        self.stdout.write(self.style.SUCCESS(f'Added {added} sample notifications for {users.count()} account(s).'))
