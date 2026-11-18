"""Adds two more categories with sub-categories, brands and sample products: python manage.py seed_demo_more

  Mobile Accessories:  Power Banks, Chargers & Cables  (the Milton flask is 500 ml)
  Home & Kitchen:      Bottles & Flasks, Lunch Boxes

Safe to run again: it only adds what is missing and never changes a category, product, price or stock you have edited.
It adds no pictures (upload those in the admin, with alt text). New main categories appear on Home by themselves.
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Brand, Category, Colour, Product, ProductSpecification, ProductVariant

# main category (name, slug, sort), then its sub-categories (name, slug, sort)
CATEGORIES = [
    (('Mobile Accessories', 'mobile-accessories', 3), [('Power Banks', 'power-banks', 1), ('Chargers & Cables', 'chargers-and-cables', 2)]),
    (('Home & Kitchen', 'home-and-kitchen', 4), [('Bottles & Flasks', 'bottles-and-flasks', 1), ('Lunch Boxes', 'lunch-boxes', 2)]),
]

# brand, main category slug it sells in
BRANDS = [
    ('Mi', 'mobile-accessories'),
    ('Ambrane', 'mobile-accessories'),
    ('Boat', 'mobile-accessories'),  # boAt already exists (Electronics); it now sells accessories too
    ('Milton', 'home-and-kitchen'),
    ('Cello', 'home-and-kitchen'),
]

COLOURS = {'Black': '#000000', 'Blue': '#1E4FBF', 'Red': '#D93025', 'White': '#FFFFFF', 'Silver': '#C0C0C0', 'Purple': '#6B5B95'}

# sub-category slug, brand, product name, featured, description, specs, variants (colour, price, mrp, stock)
PRODUCTS = [
    ('power-banks', 'Mi', 'Mi 20000 mAh Power Bank 3i', True,
     'High-capacity power bank with 18W fast charging and two USB outputs.',
     [('Capacity', '20000 mAh'), ('Fast charging', '18W'), ('Ports', '2 USB-A outputs, Type-C and Micro-USB input')],
     [('Blue', '1799', '2999', 40), ('Black', '1799', '2999', 30)]),
    ('power-banks', 'Mi', 'Mi 10000 mAh Power Bank', False,
     'Pocket-size power bank with 18W fast charging and two USB outputs.',
     [('Capacity', '10000 mAh'), ('Fast charging', '18W'), ('Ports', '2 USB-A, 1 Type-C')],
     [('Purple', '899', '1499', 40)]),
    ('power-banks', 'Ambrane', 'Ambrane 10000 mAh Slim Power Bank', False,
     'Slim, pocket-friendly power bank with 20W fast charging.',
     [('Capacity', '10000 mAh'), ('Fast charging', '20W'), ('Ports', '1 USB-A, 1 Type-C')],
     [('Blue', '999', '1999', 60), ('Black', '999', '1999', 45)]),
    ('chargers-and-cables', 'Mi', 'Mi 33W SonicCharge 2.0 Fast Charger', False,
     'Wall charger with 33W fast charging and a Type-C cable in the box.',
     [('Power', '33W'), ('In the box', 'Charger and Type-C cable')],
     [('White', '999', '1499', 50)]),
    ('chargers-and-cables', 'Boat', 'boAt Type-C Fast Charging Cable, 1.5 m', False,
     'Tough braided Type-C cable for fast charging and data.',
     [('Length', '1.5 m'), ('Connector', 'Type-C (Black: Type-C to Type-C, Red: USB-A to Type-C)')],
     [('Black', '249', '799', 120), ('Red', '249', '799', 80)]),
    ('bottles-and-flasks', 'Milton', 'Milton Thermosteel Flask, 500 ml', True,
     'Double-wall stainless steel flask that keeps drinks hot or cold for hours.',
     [('Capacity', '500 ml'), ('Material', 'Stainless steel')],
     [('Silver', '899', '1495', 35)]),
    ('bottles-and-flasks', 'Cello', 'Cello Puro Steel-X Water Bottle, 750 ml', False,
     'Leak-proof stainless steel bottle for school, office and travel.',
     [('Capacity', '750 ml'), ('Material', 'Stainless steel')],
     [('Blue', '349', '599', 70), ('Black', '349', '599', 55)]),
    ('lunch-boxes', 'Milton', 'Milton Steel Tiffin, 3 Containers', False,
     'Three stainless steel containers with an insulated carry bag.',
     [('Containers', '3'), ('Material', 'Stainless steel')],
     [('Black', '549', '899', 40)]),
    ('lunch-boxes', 'Cello', 'Cello Max Fresh Lunch Box, Set of 3', False,
     'Microwave-safe plastic lunch box set with leak-proof lids.',
     [('Pieces', '3'), ('Material', 'Food-grade plastic')],
     [('Red', '299', '499', 60), ('Blue', '299', '499', 50)]),
]


class Command(BaseCommand):
    help = 'Adds Mobile Accessories and Home & Kitchen with sub-categories, brands and sample products (no pictures).'

    @transaction.atomic
    def handle(self, *args, **options):
        categories = {}
        made_categories = 0
        for (name, slug, sort), subs in CATEGORIES:
            main, created = Category.objects.get_or_create(slug=slug, defaults={'name': name, 'sort_order': sort})
            made_categories += created
            categories[slug] = main
            for sub_name, sub_slug, sub_sort in subs:
                sub, created = Category.objects.get_or_create(slug=sub_slug, defaults={'name': sub_name, 'parent': main, 'sort_order': sub_sort})
                made_categories += created
                categories[sub_slug] = sub

        brands = {}
        made_brands = 0
        for name, main_slug in BRANDS:
            brand, created = Brand.objects.get_or_create(name=name, defaults={'slug': name.lower()})
            made_brands += created
            brand.categories.add(categories[main_slug])  # adding twice is harmless; other categories stay
            brands[name] = brand

        colours = {}
        for name, hex_code in COLOURS.items():
            colours[name], _ = Colour.objects.get_or_create(name=name, defaults={'hex_code': hex_code})

        made_products = made_variants = 0
        for category_slug, brand_name, name, featured, description, specs, variants in PRODUCTS:
            slug = name.lower().replace(',', '').replace('+', 'plus').replace(' ', '-')
            slug = ''.join(ch for ch in slug if ch.isalnum() or ch == '-')
            product, created = Product.objects.get_or_create(
                slug=slug,
                defaults={'category': categories[category_slug], 'brand': brands[brand_name], 'name': name, 'is_sponsored': featured, 'description': description},
            )
            made_products += created
            if created:
                for order, (spec_name, value) in enumerate(specs, start=1):
                    ProductSpecification.objects.create(product=product, name=spec_name, value=value, sort_order=order)
            for colour_name, price, mrp, stock in variants:
                sku = f'{slug[:30]}-{colour_name}'.upper().replace('-', '')[:50]
                _, variant_created = ProductVariant.objects.get_or_create(
                    sku=sku,
                    defaults={'product': product, 'colour': colours[colour_name], 'price': Decimal(price), 'mrp': Decimal(mrp), 'stock': stock},
                )
                made_variants += variant_created

        self.stdout.write(self.style.SUCCESS(
            f'Added {made_categories} categories, {made_brands} brands, {made_products} products and {made_variants} variants '
            f'({Product.objects.count()} products in total).'
        ))
