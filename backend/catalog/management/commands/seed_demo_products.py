"""Adds sample products for the demo: python manage.py seed_demo_products

Safe to run again: it only adds what is missing. It never changes a product, price or stock you
have already edited, and it adds no pictures (upload those in the admin, with alt text).
It needs the categories and brands to exist already (Electronics, Stationery and their
sub-categories; Boat, Sony, Pentonic and Reynolds).
"""

from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from catalog.models import Brand, Category, Colour, Product, ProductSpecification, ProductVariant

COLOURS = {
    'Black': '#000000',
    'Blue': '#1E4FBF',
    'Red': '#D93025',
    'White': '#FFFFFF',
}

# category slug, brand name, product name, sponsored, description, specs, variants (colour, price, mrp, stock)
PRODUCTS = [
    ('headphones', 'Boat', 'boAt BassHeads 100 Wired Earphones', False,
     'In-ear wired earphones with deep bass, an in-line microphone and a 3.5 mm plug.',
     [('Connectivity', 'Wired, 3.5 mm'), ('Microphone', 'Yes, in-line')],
     [('Red', '399', '999', 40), ('Black', '399', '999', 25)]),
    ('headphones', 'Sony', 'Sony MDR-EX15AP Wired In-Ear Headphones', True,
     'Lightweight in-ear headphones with a built-in microphone for calls.',
     [('Connectivity', 'Wired, 3.5 mm'), ('Cable length', '1.2 m')],
     [('Black', '799', '1490', 30), ('White', '799', '1490', 0)]),
    ('neckband', 'Boat', 'boAt Rockerz 255 Pro+ Bluetooth Neckband', False,
     'Bluetooth neckband with magnetic earbuds and up to 40 hours of playback.',
     [('Connectivity', 'Bluetooth 5.0'), ('Battery life', 'Up to 40 hours')],
     [('Blue', '1299', '3990', 20), ('Black', '1299', '3990', 15)]),
    ('neckband', 'Sony', 'Sony WI-C100 Wireless Neckband', False,
     'Wireless in-ear neckband with clear calls and all-day battery.',
     [('Connectivity', 'Bluetooth 5.0'), ('Battery life', 'Up to 25 hours')],
     [('Black', '2490', '3990', 10)]),
    ('earbuds', 'Boat', 'boAt Airdopes 141 True Wireless Earbuds', False,
     'True wireless earbuds with a compact charging case and low-latency mode.',
     [('Connectivity', 'Bluetooth 5.3'), ('Playback', 'Up to 42 hours with case')],
     [('Black', '1099', '4490', 35), ('Blue', '1099', '4490', 12)]),
    ('earbuds', 'Sony', 'Sony WF-C500 True Wireless Earbuds', False,
     'Small, light true wireless earbuds with a clear, natural sound.',
     [('Connectivity', 'Bluetooth 5.0'), ('Playback', 'Up to 20 hours with case')],
     [('White', '5990', '8990', 8)]),
    ('gel-pens', 'Reynolds', 'Reynolds Jiffy Gel Pen, Pack of 5', True,
     'Smooth-writing gel pens with a comfortable grip.',
     [('Pack size', '5 pens'), ('Tip size', '0.5 mm')],
     [('Blue', '60', '75', 100), ('Black', '60', '75', 80)]),
    ('gel-pens', 'Pentonic', 'Pentonic Gel Pen, Pack of 5', False,
     'Quick-drying gel ink for neat, smudge-free writing.',
     [('Pack size', '5 pens'), ('Tip size', '0.5 mm')],
     [('Blue', '75', '100', 60)]),
    ('ball-pens', 'Pentonic', 'Pentonic Ball Pen, Pack of 10', False,
     'Classic ball pens with a smooth flow and a sturdy tip.',
     [('Pack size', '10 pens'), ('Tip size', '0.7 mm')],
     [('Black', '80', '100', 50), ('Blue', '80', '100', 60)]),
    ('ball-pens', 'Reynolds', 'Reynolds 045 Carbureted Ball Pen, Pack of 10', False,
     'A well-known everyday ball pen for school and office.',
     [('Pack size', '10 pens'), ('Tip size', '0.7 mm')],
     [('Blue', '95', '120', 70)]),
]


# The main category each demo brand sells in (only filled in when the brand has none ticked yet).
BRAND_CATEGORIES = {'Boat': 'electronics', 'Sony': 'electronics', 'Pentonic': 'stationery', 'Reynolds': 'stationery'}


class Command(BaseCommand):
    help = 'Adds sample products (no pictures). Safe to run more than once.'

    @transaction.atomic
    def handle(self, *args, **options):
        categories = {c.slug: c for c in Category.objects.all()}
        brands = {b.name: b for b in Brand.objects.all()}
        wanted_categories = {slug for slug, *_ in PRODUCTS} | set(BRAND_CATEGORIES.values())
        missing = sorted({slug for slug in wanted_categories if slug not in categories} | {b for _, b, *_ in PRODUCTS if b not in brands})
        if missing:
            raise CommandError(f'Add these in the admin first, then run again: {", ".join(missing)}')

        # Tell each demo brand which main category it sells in, unless you have already set it yourself.
        for brand_name, main_slug in BRAND_CATEGORIES.items():
            if not brands[brand_name].categories.exists():
                brands[brand_name].categories.add(categories[main_slug])

        colours = {}
        for name, hex_code in COLOURS.items():
            colours[name], _ = Colour.objects.get_or_create(name=name, defaults={'hex_code': hex_code})

        made_products = made_variants = 0
        for category_slug, brand_name, name, sponsored, description, specs, variants in PRODUCTS:
            slug = name.lower().replace(',', '').replace('+', 'plus').replace(' ', '-')
            slug = ''.join(ch for ch in slug if ch.isalnum() or ch == '-')
            product, created = Product.objects.get_or_create(
                slug=slug,
                defaults={'category': categories[category_slug], 'brand': brands[brand_name], 'name': name,
                          'is_sponsored': sponsored, 'description': description},
            )
            made_products += created
            if created:
                for order, (spec_name, value) in enumerate(specs, start=1):
                    ProductSpecification.objects.create(product=product, name=spec_name, value=value, sort_order=order)
            for colour_name, price, mrp, stock in variants:
                sku = f'{slug[:30]}-{colour_name}'.upper().replace('-', '')[:50]
                _, variant_created = ProductVariant.objects.get_or_create(
                    sku=sku,
                    defaults={'product': product, 'colour': colours[colour_name], 'price': Decimal(price),
                              'mrp': Decimal(mrp), 'stock': stock},
                )
                made_variants += variant_created

        self.stdout.write(self.style.SUCCESS(
            f'Added {made_products} new products and {made_variants} new variants '
            f'({Product.objects.count()} products in total). Run it again any time: it only adds what is missing.'
        ))
