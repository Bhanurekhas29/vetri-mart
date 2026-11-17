"""Product lists: a category, a collection ("See all") or search results, with sort, filters and paging.

One query builder serves all three, so the grid, sort and filters behave the same everywhere.
A product is judged by the version the card shows: its cheapest active version. Price, "minimum discount" and the
discount sort all use that version, so the list never disagrees with what the card says.
"""

from decimal import Decimal, InvalidOperation

from django.db.models import Case, DecimalField, Exists, F, OuterRef, Q, Subquery, When
from django.http import Http404

from accounts.exceptions import ApiError

from .models import Brand, Category, Collection, CollectionItem, Colour, ProductVariant, Size
from .queries import card_queryset

PAGE_SIZE = 20

SORTS = {
    'relevance': 'Relevance',
    'price_asc': 'Price: low to high',
    'price_desc': 'Price: high to low',
    'newest': 'Newest first',
    'discount': 'Discount: highest first',
}


def _decimal(value, name):
    try:
        number = Decimal(value)
    except (InvalidOperation, TypeError):
        raise ApiError('invalid_filter', f'{name} must be a number.', 400)
    if number < 0:
        raise ApiError('invalid_filter', f'{name} cannot be negative.', 400)
    return number


def _ids(value, name):
    ids = []
    for part in (value or '').split(','):
        part = part.strip()
        if not part:
            continue
        if not part.isdigit():
            raise ApiError('invalid_filter', f'{name} must be a list of numbers.', 400)
        ids.append(int(part))
    return ids[:50]


def find_scope(params):
    """The category and/or collection the list is about. Unknown or switched-off ones give a 404."""
    category = collection = None
    if params.get('category'):
        category = Category.objects.filter(slug=params['category'], is_active=True).select_related('parent').first()
        if category is None:
            raise Http404
    if params.get('collection'):
        collection = Collection.objects.filter(slug=params['collection'], is_active=True).first()
        if collection is None:
            raise Http404
    return category, collection


def scope_queryset(category, collection, q):
    """Products in the scope, before any filter. Used for the list and for working out which filters to offer."""
    qs = card_queryset()
    if category is not None:
        qs = qs.filter(Q(category=category) | Q(category__parent=category))
    if collection is not None:
        qs = qs.filter(Exists(CollectionItem.objects.filter(collection=collection, product=OuterRef('pk'))))
    for word in (q or '').split()[:6]:
        qs = qs.filter(
            Q(name__icontains=word) | Q(brand__name__icontains=word)
            | Q(category__name__icontains=word) | Q(category__parent__name__icontains=word)
        )
    return qs


def build_listing(params):
    """Returns (queryset in the requested order, category, collection)."""
    category, collection = find_scope(params)
    qs = scope_queryset(category, collection, params.get('q', ''))

    cheapest = ProductVariant.objects.filter(product=OuterRef('pk'), is_active=True).order_by('price', 'id')
    qs = qs.annotate(
        cheap_price=Subquery(cheapest.values('price')[:1]),
        cheap_mrp=Subquery(cheapest.values('mrp')[:1]),
    ).annotate(
        discount=Case(
            When(cheap_mrp__gt=F('cheap_price'), then=(F('cheap_mrp') - F('cheap_price')) * 100 / F('cheap_mrp')),
            default=Decimal('0'),
            output_field=DecimalField(max_digits=7, decimal_places=2),
        )
    )

    # ---- filters ----
    if params.get('min_price'):
        qs = qs.filter(cheap_price__gte=_decimal(params['min_price'], 'Minimum price'))
    if params.get('max_price'):
        qs = qs.filter(cheap_price__lte=_decimal(params['max_price'], 'Maximum price'))
    if params.get('min_discount'):
        # the card shows the rounded percentage, so "30% or more" accepts anything that rounds to 30
        qs = qs.filter(discount__gte=_decimal(params['min_discount'], 'Minimum discount') - Decimal('0.5'))
    if params.get('in_stock') in ('1', 'true', 'True'):
        qs = qs.filter(Exists(ProductVariant.objects.filter(product=OuterRef('pk'), is_active=True, stock__gt=0)))
    brands = [b for b in (params.get('brand') or '').split(',') if b.strip()][:30]
    if brands:
        qs = qs.filter(brand__slug__in=[b.strip() for b in brands])
    colours = _ids(params.get('colour'), 'Colour')
    if colours:
        qs = qs.filter(Exists(ProductVariant.objects.filter(product=OuterRef('pk'), is_active=True, colour_id__in=colours)))
    sizes = _ids(params.get('size'), 'Size')
    if sizes:
        qs = qs.filter(Exists(ProductVariant.objects.filter(product=OuterRef('pk'), is_active=True, size_id__in=sizes)))

    # ---- sort ----
    sort = params.get('sort') or 'relevance'
    if sort not in SORTS:
        raise ApiError('invalid_sort', 'Unknown sort.', 400)
    if sort == 'price_asc':
        order = ['cheap_price', 'id']
    elif sort == 'price_desc':
        order = ['-cheap_price', 'id']
    elif sort == 'newest':
        order = ['-created_at', '-id']
    elif sort == 'discount':
        order = ['-discount', '-created_at', 'id']
    elif collection is not None:
        # Relevance inside a collection: Featured first, then the admin's order for the collection.
        position = CollectionItem.objects.filter(collection=collection, product=OuterRef('pk')).values('sort_order')[:1]
        qs = qs.annotate(position=Subquery(position))
        order = ['-is_sponsored', 'position', 'id']
    else:
        order = ['-is_sponsored', '-created_at', '-id']  # Featured first, then newest
    return qs.order_by(*order), category, collection


def category_info(category):
    """What the screen needs about a category: its name, and the main category with the sub-category chips."""
    if category is None:
        return None
    main = category.parent or category
    children = main.children.filter(is_active=True)
    return {
        'name': category.name,
        'slug': category.slug,
        'main': {
            'name': main.name,
            'slug': main.slug,
            'children': [{'name': c.name, 'slug': c.slug} for c in children],
        },
    }


def filter_options(params):
    """The choices the Filter panel offers for this list: brands, colours, sizes and the price range."""
    category, collection = find_scope(params)
    qs = scope_queryset(category, collection, params.get('q', ''))
    product_ids = list(qs.values_list('pk', flat=True))
    variants = ProductVariant.objects.filter(product_id__in=product_ids, is_active=True)
    prices = list(variants.values_list('price', flat=True))
    return {
        'brands': [{'name': b.name, 'slug': b.slug} for b in Brand.objects.filter(products__in=product_ids).distinct().order_by('name')],
        'colours': [{'id': c.id, 'name': c.name, 'hex': c.hex_code} for c in Colour.objects.filter(variants__in=variants).distinct().order_by('name')],
        'sizes': [{'id': s.id, 'name': s.name} for s in Size.objects.filter(variants__in=variants).distinct()],
        'price_min': str(min(prices)) if prices else None,
        'price_max': str(max(prices)) if prices else None,
        'discounts': [10, 20, 30, 50],
    }
