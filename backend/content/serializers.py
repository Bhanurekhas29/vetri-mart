from rest_framework import serializers

from catalog.serializers import ProductCardSerializer, file_url

from .models import Banner, OnboardingSlide


class OnboardingSlideSerializer(serializers.ModelSerializer):
    # `image` is the full web address of the uploaded picture, or null when there is none.
    image = serializers.ImageField(read_only=True, use_url=True)

    class Meta:
        model = OnboardingSlide
        fields = ['id', 'title', 'subtitle', 'image', 'alt_text']


# ---------- Home page ----------

class CategoryTileSerializer(serializers.Serializer):
    """One round icon in the category strip."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.CharField()
    icon = serializers.SerializerMethodField()
    icon_alt = serializers.CharField()

    def get_icon(self, category) -> str | None:
        return file_url(self.context.get('request'), category.icon)


class BannerSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = ['id', 'title', 'image', 'alt_text', 'target']

    def get_image(self, banner) -> str | None:
        return file_url(self.context.get('request'), banner.image)

    def get_target(self, banner) -> dict | None:
        """Where a tap on the banner goes: a category, a product or a collection. Null if nothing, or if it is switched off."""
        if banner.target_category_id and banner.target_category.is_active:
            return {'type': 'category', 'slug': banner.target_category.slug}
        if banner.target_product_id and banner.target_product.is_active:
            return {'type': 'product', 'slug': banner.target_product.slug}
        if banner.target_collection_id and banner.target_collection.is_active:
            return {'type': 'collection', 'slug': banner.target_collection.slug}
        return None


class DealSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    ends_at = serializers.DateTimeField()
    seconds_left = serializers.IntegerField()
    products = ProductCardSerializer(many=True)


class HomeSectionSerializer(serializers.Serializer):
    """Shape of one Home section, for the docs page. Only the fields that fit its `kind` are present."""

    id = serializers.IntegerField()
    kind = serializers.ChoiceField(choices=['category_strip', 'banner_carousel', 'deal_of_day', 'product_row', 'mid_banner'])
    title = serializers.CharField()
    categories = CategoryTileSerializer(many=True, required=False)
    banners = BannerSerializer(many=True, required=False)
    deal = DealSerializer(required=False)
    collection = serializers.DictField(required=False)
    products = ProductCardSerializer(many=True, required=False)
    has_more = serializers.BooleanField(required=False)


class HomeResponseSerializer(serializers.Serializer):
    announcements = serializers.ListField(child=serializers.CharField(), help_text='Live messages for the moving line, in order. Empty = hide the line.')
    announcement_speed = serializers.ChoiceField(choices=['slow', 'normal', 'fast'], help_text='How fast the moving line runs.')
    sections = HomeSectionSerializer(many=True)
