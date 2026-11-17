"""Adds three demo coupons so the coupon box in the cart can be tried.

  WELCOME10  10% off, up to Rs 100, minimum order Rs 299
  FLAT50     Rs 50 off, minimum order Rs 499
  FESTIVE20  20% off, up to Rs 200, minimum order Rs 999

Each is valid for 60 days from today. Safe to run again: only missing codes are added and edited ones are never changed.
Shoppers can use each code once. Edit, switch off or add coupons in the admin (Orders > Coupons).
"""

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from orders.models import Coupon

DEMO = [
    ('WELCOME10', Coupon.Kind.PERCENT, '10', '100', '299'),
    ('FLAT50', Coupon.Kind.FLAT, '50', None, '499'),
    ('FESTIVE20', Coupon.Kind.PERCENT, '20', '200', '999'),
]


class Command(BaseCommand):
    help = 'Add the demo coupons WELCOME10, FLAT50 and FESTIVE20.'

    def handle(self, *args, **options):
        now = timezone.now()
        added = 0
        for code, kind, value, cap, minimum in DEMO:
            _, created = Coupon.objects.get_or_create(
                code=code,
                defaults={
                    'kind': kind, 'value': Decimal(value), 'max_discount': Decimal(cap) if cap else None,
                    'min_order_amount': Decimal(minimum), 'valid_from': now - timedelta(days=1), 'valid_until': now + timedelta(days=60),
                },
            )
            added += created
        self.stdout.write(self.style.SUCCESS(f'Added {added} demo coupons.'))
