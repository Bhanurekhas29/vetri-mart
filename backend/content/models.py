import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from catalog.models import Category, Collection, Product


class HomeSection(models.Model):
    """One block on the Home screen. The admin reorders and toggles them; the app draws what the API returns."""

    class Kind(models.TextChoices):
        CATEGORY_STRIP = 'category_strip', 'Category strip'
        BANNER_CAROUSEL = 'banner_carousel', 'Banner carousel'
        DEAL_OF_DAY = 'deal_of_day', 'Deal of the day'
        PRODUCT_ROW = 'product_row', 'Product row'
        MID_BANNER = 'mid_banner', 'Mid-page banner'

    BANNER_KINDS = (Kind.BANNER_CAROUSEL, Kind.MID_BANNER)

    title = models.CharField(max_length=100, blank=True)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    item_limit = models.PositiveSmallIntegerField(default=6, help_text="Items shown before 'See all'.")
    collection = models.ForeignKey(
        Collection, null=True, blank=True, on_delete=models.PROTECT, related_name='home_sections',
        help_text='Products for a product row.',
    )

    class Meta:
        ordering = ['sort_order', 'id']

    def clean(self):
        if self.kind == self.Kind.PRODUCT_ROW and not self.collection_id:
            raise ValidationError({'collection': 'A product row needs a collection.'})
        if self.kind != self.Kind.PRODUCT_ROW and self.collection_id:
            raise ValidationError({'collection': 'Only a product row uses a collection.'})

    def __str__(self):
        return self.title or self.get_kind_display()


class Banner(models.Model):
    section = models.ForeignKey(HomeSection, on_delete=models.CASCADE, related_name='banners')
    title = models.CharField(max_length=100, blank=True, help_text='Optional headline text.')
    image = models.ImageField(upload_to='banners/')
    alt_text = models.CharField(max_length=150, help_text='Describe the banner picture. Required.')
    target_category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.PROTECT, related_name='+')
    target_product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.PROTECT, related_name='+')
    target_collection = models.ForeignKey(Collection, null=True, blank=True, on_delete=models.PROTECT, related_name='+')
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(target_category__isnull=True, target_product__isnull=True)
                    | Q(target_category__isnull=True, target_collection__isnull=True)
                    | Q(target_product__isnull=True, target_collection__isnull=True)
                ),
                name='banner_at_most_one_target',
            ),
        ]

    def clean(self):
        if self.alt_text is not None and not self.alt_text.strip():
            raise ValidationError({'alt_text': 'Describe the picture (alt text). It is required.'})
        if self.section_id and self.section.kind not in HomeSection.BANNER_KINDS:
            raise ValidationError({'section': 'Banners go in a banner carousel or a mid-page banner section.'})

    def __str__(self):
        return self.title or f'Banner {self.pk}'


class Deal(models.Model):
    """A scheduled deal of the day. The Home section shows whichever deal is active now."""

    name = models.CharField(max_length=100)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-starts_at']
        constraints = [
            models.CheckConstraint(condition=Q(ends_at__gt=F('starts_at')), name='deal_ends_after_start'),
        ]

    @classmethod
    def current(cls):
        now = timezone.now()
        return cls.objects.filter(is_active=True, starts_at__lte=now, ends_at__gt=now).order_by('ends_at').first()

    def __str__(self):
        return self.name


class Announcement(models.Model):
    """One message in the moving line under the pincode bar on Home, e.g. "Monday sale is live".

    All messages that are live right now run together in a single line, in `sort_order`.
    Leave both dates empty for a message that is always on (while Active is ticked).
    """

    text = models.CharField(max_length=150, help_text='The message shoppers see, for example: Monday sale is live!')
    is_active = models.BooleanField(default=True, help_text='Untick to switch it off without deleting it.')
    starts_at = models.DateTimeField(null=True, blank=True, help_text='Optional. Shown from this time. Empty = already started.')
    ends_at = models.DateTimeField(null=True, blank=True, help_text='Optional. Hidden after this time. Empty = never ends.')
    sort_order = models.PositiveIntegerField(default=0, help_text='Smaller numbers run first.')

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.CheckConstraint(
                condition=Q(starts_at__isnull=True) | Q(ends_at__isnull=True) | Q(ends_at__gt=F('starts_at')),
                name='announcement_ends_after_start',
            ),
        ]

    def clean(self):
        self.text = ' '.join((self.text or '').split())  # one line: no line breaks, no double spaces
        if not self.text:
            raise ValidationError({'text': 'Type the message.'})
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValidationError({'ends_at': 'The end time must be after the start time.'})

    @classmethod
    def live(cls):
        """The messages to show right now, in order."""
        now = timezone.now()
        return cls.objects.filter(is_active=True).filter(
            Q(starts_at__isnull=True) | Q(starts_at__lte=now),
            Q(ends_at__isnull=True) | Q(ends_at__gt=now),
        )

    def __str__(self):
        return self.text


class DealItem(models.Model):
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='deal_items')
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['deal', 'product'], name='uniq_product_per_deal'),
        ]

    def __str__(self):
        return f'{self.deal.name}: {self.product.name}'


class SearchTerm(models.Model):
    """Every search is counted; the top terms become 'Popular searches'."""

    term = models.CharField(max_length=100, unique=True)
    count = models.PositiveIntegerField(default=0)
    last_searched_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-count']

    @staticmethod
    def normalise(text):
        return re.sub(r'\s+', ' ', (text or '').strip().lower())[:100]

    @classmethod
    def record(cls, text):
        term = cls.normalise(text)
        if len(term) < 2:
            return None
        obj, _ = cls.objects.get_or_create(term=term)
        cls.objects.filter(pk=obj.pk).update(count=F('count') + 1, last_searched_at=timezone.now())
        return term

    def __str__(self):
        return f'{self.term} ({self.count})'


class OnboardingSlide(models.Model):
    title = models.CharField(max_length=100)
    subtitle = models.CharField(max_length=200, blank=True)
    image = models.ImageField(upload_to='onboarding/', blank=True)  # blank: the app shows a simple icon instead
    alt_text = models.CharField(max_length=150, blank=True, help_text='Describe the picture. Required when an image is added.')
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def clean(self):
        if self.image and not self.alt_text.strip():
            raise ValidationError({'alt_text': 'Describe the picture (alt text). It is required when an image is added.'})

    def __str__(self):
        return self.title


class Notification(models.Model):
    """Written automatically when an order status or payment changes (see signals.py)."""

    class Kind(models.TextChoices):
        ORDER = 'order', 'Order'
        PAYMENT = 'payment', 'Payment'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    kind = models.CharField(max_length=10, choices=Kind.choices)
    title = models.CharField(max_length=120)
    message = models.CharField(max_length=300)
    order = models.ForeignKey('orders.Order', null=True, blank=True, on_delete=models.CASCADE, related_name='notifications')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'is_read', '-created_at'])]

    def __str__(self):
        return f'{self.user}: {self.title}'


class FAQ(models.Model):
    question = models.CharField(max_length=255)
    answer = models.TextField()
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'id']
        verbose_name = 'FAQ'
        verbose_name_plural = 'FAQs'

    def __str__(self):
        return self.question


class ContactInfo(models.Model):
    """A single row of support contact details."""

    support_email = models.EmailField(blank=True)
    support_phone = models.CharField(max_length=20, blank=True)
    hours = models.CharField(max_length=100, blank=True, help_text='For example: 10 am to 6 pm, Monday to Saturday')

    class Meta:
        verbose_name_plural = 'contact info'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'Contact info'


class StaticPage(models.Model):
    """Terms, Privacy, About: text managed in the admin."""

    slug = models.SlugField(max_length=50, unique=True)
    title = models.CharField(max_length=100)
    body = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


