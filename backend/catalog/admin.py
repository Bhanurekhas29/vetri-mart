from django import forms
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.forms.models import BaseInlineFormSet
from django.http import JsonResponse
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html

from .models import (
    Bundle, BundleItem, Brand, Category, Collection, CollectionItem, Colour,
    Product, ProductImage, ProductQuestion, ProductSpecification, ProductVariant,
    Review, Size, WishlistItem,
)


def _hide_related_icons(formfield):
    """Removes the pencil, plus, cross and eye icons that sit beside a dropdown."""
    widget = getattr(formfield, 'widget', None)
    for attr in ('can_add_related', 'can_change_related', 'can_delete_related', 'can_view_related'):
        if hasattr(widget, attr):
            setattr(widget, attr, False)


class NoRelatedIconsMixin:
    """Nothing can be edited or deleted by accident from inside a product page: brands, categories and
    colours are managed from their own menus."""

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        # This runs after Django has wrapped the dropdown with its icon buttons, so we can switch them off.
        formfield = super().formfield_for_dbfield(db_field, request, **kwargs)
        _hide_related_icons(formfield)
        return formfield


def thumbnail(image, size=48):
    """A small preview of an uploaded picture, for the admin screens."""
    if not image:
        return '-'
    return format_html(
        '<img src="{}" style="height:{}px;width:{}px;object-fit:cover;border-radius:6px;" alt="">', image.url, size, size
    )


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('icon_thumb', '__str__', 'sort_order', 'is_active')
    list_display_links = ('__str__',)
    list_filter = ('is_active', 'parent')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}
    fields = ('name', 'slug', 'parent', 'icon', 'icon_preview', 'icon_alt', 'sort_order', 'is_active')
    readonly_fields = ('icon_preview',)

    @admin.display(description='Image')
    def icon_thumb(self, obj):
        return thumbnail(obj.icon)

    @admin.display(description='Current image')
    def icon_preview(self, obj):
        return thumbnail(obj.icon, 64)


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('logo_thumb', 'name', 'sells_in', 'is_active')
    list_display_links = ('name',)
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}
    fields = ('name', 'slug', 'logo', 'logo_preview', 'logo_alt', 'categories', 'is_active')
    readonly_fields = ('logo_preview',)
    formfield_overrides = {models.ManyToManyField: {'widget': forms.CheckboxSelectMultiple}}

    @admin.display(description='Logo')
    def logo_thumb(self, obj):
        return thumbnail(obj.logo)

    @admin.display(description='Sells in')
    def sells_in(self, obj):
        names = [c.name for c in obj.categories.all()]
        return ', '.join(names) if names else 'Every category'

    @admin.display(description='Current logo')
    def logo_preview(self, obj):
        return thumbnail(obj.logo, 64)


@admin.register(Colour)
class ColourAdmin(admin.ModelAdmin):
    list_display = ('name', 'hex_code')
    search_fields = ('name',)


@admin.register(Size)
class SizeAdmin(admin.ModelAdmin):
    list_display = ('name', 'sort_order')
    search_fields = ('name',)


# The product page is one page with numbered sections: 1 details, 2 prices and stock, 3 pictures,
# 4 specifications, and a collapsed Extras box. The headings below are the section titles.
class VersionFormSet(BaseInlineFormSet):
    """A product with no version can never be bought, so saving needs at least one filled-in version."""

    def clean(self):
        super().clean()
        if any(self.errors):
            return  # the individual mistakes are shown first
        kept = [f for f in self.forms if f.cleaned_data and not f.cleaned_data.get('DELETE')]
        if not kept:
            raise ValidationError(
                'Add at least one version with a SKU, selling price, MRP and stock. '
                'A product with no version cannot be bought, so it would not appear in the app.'
            )


class VariantInline(NoRelatedIconsMixin, admin.StackedInline):
    model = ProductVariant
    formset = VersionFormSet
    extra = 0
    min_num = 1  # shows one version form to start with
    verbose_name = 'Version'
    verbose_name_plural = '2. Prices and stock (required, at least one version)'
    # The stylesheet lays these out as a grid, three boxes per row: SKU, price, MRP, then stock, colour, size.
    fields = ('sku', 'price', 'mrp', 'stock', 'colour', 'size', 'is_active')


class ImageInline(NoRelatedIconsMixin, admin.StackedInline):
    model = ProductImage
    extra = 1
    verbose_name = 'Picture'
    verbose_name_plural = '3. Pictures (recommended, the first one is the main picture)'
    # No "sort order" box: pictures keep the order they were added in, so the first one is the main picture.
    fields = ('image', 'preview', 'alt_text', 'colour')
    readonly_fields = ('preview',)

    @admin.display(description='Preview')
    def preview(self, obj):
        return thumbnail(obj.image, 64)


class SpecInline(admin.TabularInline):
    model = ProductSpecification
    extra = 1
    verbose_name = 'Specification'
    verbose_name_plural = '4. Specifications (optional)'
    fields = ('name', 'value')  # kept in the order they were added


@admin.register(Product)
class ProductAdmin(NoRelatedIconsMixin, admin.ModelAdmin):
    list_display = ('name', 'category', 'brand', 'is_sponsored', 'is_active', 'created_at')
    list_filter = ('is_active', 'is_sponsored', 'category', 'brand')
    search_fields = ('name', 'brand__name', 'variants__sku')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [VariantInline, ImageInline, SpecInline]
    fieldsets = (
        ('1. Basic details (required)', {
            'description': (
                'Fill the numbered sections from top to bottom. Sections 1 and 2 are required. '
                'Everything on this page belongs to this one product and is saved together when you press Save.'
            ),
            'fields': ('category', 'brand', 'name', 'slug', 'description'),
        }),
        ('Extras (optional)', {
            'classes': ('collapse', 'product-extras'),
            'fields': ('video_url', 'is_sponsored', 'is_active'),
        }),
    )

    class Media:
        # The look of the form (css) and its helpers (js): section tags, the folded Extras box, the Brand list.
        css = {'all': ('catalog/product_form.css',)}
        js = ('catalog/product_form.js',)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'category':
            # Only the most specific categories (Earbuds, Gel Pens), never a main category that has sub-categories.
            kwargs['queryset'] = (
                Category.objects.filter(children__isnull=True)
                .select_related('parent')
                .order_by('parent__sort_order', 'sort_order', 'name')
            )
        formfield = super().formfield_for_foreignkey(db_field, request, **kwargs)
        if db_field.name == 'brand':
            inner = getattr(formfield.widget, 'widget', formfield.widget)
            inner.attrs['data-brands-url'] = reverse('admin:catalog_product_brands_for_category')
        return formfield

    def get_urls(self):
        extra = [
            path(
                'brands-for-category/',
                self.admin_site.admin_view(self.brands_for_category),
                name='catalog_product_brands_for_category',
            ),
        ]
        return extra + super().get_urls()

    def brands_for_category(self, request):
        """The brands that may be used with a category: the brands that sell in its main category, plus
        brands that sell everywhere. The product form asks for this when a category is chosen."""
        if not self.has_view_or_change_permission(request):
            return JsonResponse({'brands': []}, status=403)
        category_id = request.GET.get('category', '')
        category = None
        if category_id.isdigit():  # anything else (empty, text) just means "no category chosen"
            category = Category.objects.select_related('parent').filter(pk=int(category_id)).first()
        brands = Brand.objects.all()
        if category:
            main = category.parent or category
            brands = brands.filter(Q(categories=main) | Q(categories__isnull=True)).distinct()
        return JsonResponse({'brands': [{'id': b.pk, 'name': b.name} for b in brands.order_by('name')]})


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ('sku', 'product', 'colour', 'size', 'price', 'mrp', 'discount', 'stock', 'is_active')
    list_filter = ('is_active', 'colour', 'size')
    search_fields = ('sku', 'product__name')
    raw_id_fields = ('product',)

    @admin.display(description='Discount')
    def discount(self, obj):
        return f'{obj.discount_percent}%'


class BundleItemInline(admin.TabularInline):
    model = BundleItem
    extra = 2
    raw_id_fields = ('variant',)


@admin.register(Bundle)
class BundleAdmin(admin.ModelAdmin):
    list_display = ('name', 'bundle_price', 'is_active')
    inlines = [BundleItemInline]


class CollectionItemInline(admin.TabularInline):
    model = CollectionItem
    extra = 2
    raw_id_fields = ('product',)


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [CollectionItemInline]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('product', 'rating', 'reviewer', 'verified', 'is_visible', 'created_at')
    list_filter = ('rating', 'is_visible')
    search_fields = ('product__name', 'reviewer_name', 'user__email', 'title')
    raw_id_fields = ('product', 'user', 'order_item')

    @admin.display(description='Reviewer')
    def reviewer(self, obj):
        return obj.user.name if obj.user_id else obj.reviewer_name

    @admin.display(description='Verified purchase', boolean=True)
    def verified(self, obj):
        return obj.is_verified_purchase


@admin.register(ProductQuestion)
class ProductQuestionAdmin(admin.ModelAdmin):
    list_display = ('question', 'product', 'user', 'answered', 'created_at')
    list_filter = (('answered_at', admin.EmptyFieldListFilter),)
    search_fields = ('question', 'product__name', 'user__email')
    raw_id_fields = ('product', 'user')
    readonly_fields = ('answered_at', 'created_at')

    @admin.display(description='Answered', boolean=True)
    def answered(self, obj):
        return obj.is_answered

    def save_model(self, request, obj, form, change):
        if obj.is_answered and not obj.answered_at:
            obj.answered_at = timezone.now()
        elif not obj.is_answered:
            obj.answered_at = None
        super().save_model(request, obj, form, change)


@admin.register(WishlistItem)
class WishlistItemAdmin(admin.ModelAdmin):
    list_display = ('user', 'product', 'saved_price', 'added_at')
    search_fields = ('user__email', 'product__name')
    raw_id_fields = ('user', 'product')
