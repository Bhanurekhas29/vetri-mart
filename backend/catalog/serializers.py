from decimal import Decimal

from rest_framework import serializers


def file_url(request, file_field):
    """The full web address of an uploaded file, or None when there is no file."""
    if not file_field:
        return None
    return request.build_absolute_uri(file_field.url) if request else file_field.url


def money(value):
    return str(Decimal(value).quantize(Decimal('0.01')))


class ProductCardSerializer(serializers.Serializer):
    """The small product tile used on Home, listings, search and wishlists.

    Works on products loaded with catalog.queries.card_queryset(). The price shown is the cheapest
    active variant, with its own MRP, and the discount percentage is calculated from them.
    """

    id = serializers.IntegerField()
    slug = serializers.CharField()
    name = serializers.CharField()
    brand = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    image_alt = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    mrp = serializers.SerializerMethodField()
    price_from = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()
    is_sponsored = serializers.BooleanField()
    in_stock = serializers.SerializerMethodField()

    def _cheapest(self, product):
        return min(product.active_variants, key=lambda v: (v.price, v.id))

    def get_brand(self, product) -> str | None:
        return product.brand.name if product.brand_id else None

    def get_image(self, product) -> str | None:
        first = product.card_images[0] if product.card_images else None
        return file_url(self.context.get('request'), first.image) if first else None

    def get_image_alt(self, product) -> str:
        first = product.card_images[0] if product.card_images else None
        return first.alt_text if first else ''

    def get_price(self, product) -> str:
        return money(self._cheapest(product).price)

    def get_price_from(self, product) -> bool:
        """True when the versions have different prices, so the card shows "From" before the lowest one."""
        return len({v.price for v in product.active_variants}) > 1

    def get_mrp(self, product) -> str:
        return money(self._cheapest(product).mrp)

    def get_discount_percent(self, product) -> int:
        return self._cheapest(product).discount_percent

    def get_rating(self, product) -> float | None:
        avg = getattr(product, 'avg_rating', None)
        return round(float(avg), 1) if avg is not None else None

    def get_rating_count(self, product) -> int:
        return getattr(product, 'review_count', 0) or 0

    def get_in_stock(self, product) -> bool:
        return any(v.stock > 0 for v in product.active_variants)
