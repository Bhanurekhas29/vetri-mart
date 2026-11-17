from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html

from .models import (
    FAQ, Announcement, Banner, ContactInfo, Deal, DealItem, HomeSection, Notification,
    OnboardingSlide, SearchTerm, StaticPage,
)


def thumbnail(image, width=96, height=48):
    """A small preview of an uploaded picture, for the admin screens."""
    if not image:
        return '-'
    return format_html(
        '<img src="{}" style="height:{}px;width:{}px;object-fit:cover;border-radius:6px;" alt="">', image.url, height, width
    )


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    """The moving line on Home. Every live message runs in one line, in this order."""

    list_display = ('text', 'status', 'starts_at', 'ends_at', 'sort_order', 'is_active')
    list_editable = ('sort_order', 'is_active')
    list_filter = ('is_active',)
    fields = ('text', 'is_active', 'starts_at', 'ends_at', 'sort_order')

    @admin.display(description='Status')
    def status(self, obj):
        if not obj.is_active:
            return 'Off'
        now = timezone.now()
        if obj.starts_at and obj.starts_at > now:
            return 'Scheduled'
        if obj.ends_at and obj.ends_at <= now:
            return 'Ended'
        return 'Live'


class BannerInline(admin.StackedInline):
    model = Banner
    extra = 1
    raw_id_fields = ('target_product',)
    fields = ('image', 'preview', 'alt_text', 'title', 'target_category', 'target_product', 'target_collection', 'sort_order', 'is_active')
    readonly_fields = ('preview',)

    @admin.display(description='Preview')
    def preview(self, obj):
        return thumbnail(obj.image)


@admin.register(HomeSection)
class HomeSectionAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'kind', 'sort_order', 'item_limit', 'is_active')
    list_filter = ('kind', 'is_active')
    list_editable = ('sort_order', 'is_active')
    inlines = [BannerInline]


class DealItemInline(admin.TabularInline):
    model = DealItem
    extra = 3
    raw_id_fields = ('product',)


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = ('name', 'starts_at', 'ends_at', 'is_active')
    list_filter = ('is_active',)
    inlines = [DealItemInline]


@admin.register(SearchTerm)
class SearchTermAdmin(admin.ModelAdmin):
    list_display = ('term', 'count', 'last_searched_at')
    search_fields = ('term',)


@admin.register(OnboardingSlide)
class OnboardingSlideAdmin(admin.ModelAdmin):
    list_display = ('image_thumb', 'title', 'sort_order', 'is_active')
    list_display_links = ('title',)
    list_editable = ('sort_order', 'is_active')
    fields = ('title', 'subtitle', 'image', 'image_preview', 'alt_text', 'sort_order', 'is_active')
    readonly_fields = ('image_preview',)

    @admin.display(description='Image')
    def image_thumb(self, obj):
        return thumbnail(obj.image)

    @admin.display(description='Current image')
    def image_preview(self, obj):
        return thumbnail(obj.image, 96, 64)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'kind', 'is_read', 'created_at')
    list_filter = ('kind', 'is_read')
    search_fields = ('user__email', 'title')
    raw_id_fields = ('user', 'order')


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ('question', 'sort_order', 'is_active')
    list_editable = ('sort_order', 'is_active')


@admin.register(ContactInfo)
class ContactInfoAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'support_email', 'support_phone', 'hours')

    def has_add_permission(self, request):
        return not ContactInfo.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(StaticPage)
class StaticPageAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'updated_at')
    prepopulated_fields = {'slug': ('title',)}
