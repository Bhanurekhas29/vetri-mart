"""Adds demo material for the Product detail page: serviceable pincodes, sample reviews and one bundle.

Run after seed_demo_products. Safe to run again: it only adds what is missing and never changes edited data.
Sample reviews have no buyer (the admin typed them), so they show without the "Verified purchase" tag.
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Bundle, BundleItem, Product, ProductVariant, Review
from orders.models import ServiceablePincode

PINCODES = [
    # pincode, min days, max days
    ('600001', 2, 3), ('600002', 2, 3), ('600020', 2, 4), ('600124', 3, 5), ('641001', 3, 5), ('625001', 4, 6),
]

REVIEWS = {
    'boat-airdopes-141-true-wireless-earbuds': [
        ('Karthik', 5, 'Great sound for the price', 'Battery easily lasts two days and the bass is good. Connects fast.'),
        ('Divya', 4, 'Good, case is a bit big', 'Sound and mic are fine for calls. The case feels slightly bulky.'),
        ('Arun', 5, 'Worth it', 'Comfortable fit even for long use.'),
    ],
    'boat-bassheads-100-wired-earphones': [
        ('Suresh', 4, 'Strong bass', 'Good bass for this price. Cable feels sturdy.'),
        ('Meena', 3, 'Okay', 'Sound is fine, but the fit is loose for me.'),
    ],
    'sony-mdr-ex15ap-wired-in-ear-headphones': [
        ('Ravi', 5, 'Clear and balanced', 'Very clear vocals. The mic works well for calls.'),
        ('Priya', 5, 'Sony quality', 'Comfortable and the sound is clean.'),
        ('Mohan', 4, 'Good value', 'Nice build. Wish the cable was a little longer.'),
        ('Latha', 4, '', 'Does the job very well.'),
    ],
    'pentonic-ball-pen-pack-of-10': [
        ('Anitha', 5, 'Smooth writing', 'No smudging and the ink lasts long.'),
        ('Gopal', 4, 'Good pens', 'Smooth writing for exams.'),
    ],
    'reynolds-jiffy-gel-pen-pack-of-5': [
        ('Nithya', 5, 'Lovely gel pens', 'Very smooth, dries fast.'),
    ],
}


class Command(BaseCommand):
    help = 'Add demo serviceable pincodes, sample reviews and a bundle for the product page.'

    @transaction.atomic
    def handle(self, *args, **options):
        added = {'pincodes': 0, 'reviews': 0, 'bundles': 0}

        for pin, low, high in PINCODES:
            _, created = ServiceablePincode.objects.get_or_create(
                pincode=pin, defaults={'delivery_days_min': low, 'delivery_days_max': high}
            )
            added['pincodes'] += created

        for slug, rows in REVIEWS.items():
            product = Product.objects.filter(slug=slug).first()
            if product is None:
                continue
            for name, rating, title, body in rows:
                _, created = Review.objects.get_or_create(
                    product=product, reviewer_name=name, user=None, order_item=None,
                    defaults={'rating': rating, 'title': title, 'body': body},
                )
                added['reviews'] += created

        pen = ProductVariant.objects.filter(product__slug='pentonic-ball-pen-pack-of-10', is_active=True, stock__gt=0).order_by('id').first()
        gel = ProductVariant.objects.filter(product__slug='reynolds-jiffy-gel-pen-pack-of-5', is_active=True, stock__gt=0).order_by('id').first()
        if pen and gel and not Bundle.objects.filter(name='Pen starter combo').exists():
            total = pen.price + gel.price
            bundle = Bundle.objects.create(name='Pen starter combo', bundle_price=(total * Decimal('0.9')).quantize(Decimal('1')))
            BundleItem.objects.create(bundle=bundle, variant=pen, quantity=1)
            BundleItem.objects.create(bundle=bundle, variant=gel, quantity=1)
            added['bundles'] += 1

        self.stdout.write(self.style.SUCCESS(
            f"Added {added['pincodes']} pincodes, {added['reviews']} sample reviews, {added['bundles']} bundle."
        ))
