"""Sets up a sample Home page: python manage.py seed_demo_home

Creates a "Recommended deals" collection, a live "Deal of the day", and the Home sections
(category strip, deal of the day, recommended deals). Run seed_demo_products first.

Safe to run again: it only adds what is missing and never changes anything you have edited.
No banners are created, because every banner needs a picture: add those in the admin.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from catalog.models import Collection, CollectionItem, Product
from content.models import Deal, DealItem, HomeSection

DEAL_DAYS = 30  # the demo deal stays live this long; change the dates in the admin any time

RECOMMENDED = [
    'sony-mdr-ex15ap-wired-in-ear-headphones',
    'boat-airdopes-141-true-wireless-earbuds',
    'reynolds-jiffy-gel-pen-pack-of-5',
    'boat-rockerz-255-proplus-bluetooth-neckband',
    'pentonic-ball-pen-pack-of-10',
    'sony-wf-c500-true-wireless-earbuds',
    'boat-bassheads-100-wired-earphones',
    'pentonic-gel-pen-pack-of-5',
]

DEAL_PRODUCTS = [
    'boat-airdopes-141-true-wireless-earbuds',
    'boat-bassheads-100-wired-earphones',
    'reynolds-jiffy-gel-pen-pack-of-5',
    'boat-rockerz-255-proplus-bluetooth-neckband',
]


class Command(BaseCommand):
    help = 'Adds a sample Home page (collection, live deal and sections). Safe to run more than once.'

    @transaction.atomic
    def handle(self, *args, **options):
        products = {p.slug: p for p in Product.objects.all()}
        missing = [s for s in dict.fromkeys(RECOMMENDED + DEAL_PRODUCTS) if s not in products]
        if missing:
            raise CommandError('Run "python manage.py seed_demo_products" first. Missing products: ' + ', '.join(missing))

        collection, made_collection = Collection.objects.get_or_create(
            slug='recommended-deals', defaults={'name': 'Recommended deals'}
        )
        added = 0
        for order, slug in enumerate(RECOMMENDED, start=1):
            _, new = CollectionItem.objects.get_or_create(
                collection=collection, product=products[slug], defaults={'sort_order': order}
            )
            added += new

        now = timezone.now()
        deal, made_deal = Deal.objects.get_or_create(
            name='Deal of the day',
            defaults={'starts_at': now - timedelta(hours=1), 'ends_at': now + timedelta(days=DEAL_DAYS)},
        )
        for order, slug in enumerate(DEAL_PRODUCTS, start=1):
            _, new = DealItem.objects.get_or_create(deal=deal, product=products[slug], defaults={'sort_order': order})
            added += new

        made_sections = 0
        for kind, title, sort_order, limit, coll in [
            (HomeSection.Kind.CATEGORY_STRIP, '', 1, 6, None),
            (HomeSection.Kind.DEAL_OF_DAY, 'Deal of the day', 3, 6, None),
            (HomeSection.Kind.PRODUCT_ROW, 'Recommended deals', 4, 6, collection),
        ]:
            _, new = HomeSection.objects.get_or_create(
                kind=kind, title=title,
                defaults={'sort_order': sort_order, 'item_limit': limit, 'collection': coll},
            )
            made_sections += new

        self.stdout.write(self.style.SUCCESS(
            f'Home ready: {made_sections} new sections, {"a new" if made_collection else "the existing"} collection, '
            f'{"a new" if made_deal else "the existing"} deal, {added} new items. '
            f'(The deal runs for {DEAL_DAYS} days from the first run; change its dates in the admin.)'
        ))
