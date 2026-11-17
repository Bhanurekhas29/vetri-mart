from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import F, Q

hex_validator = RegexValidator(r'^#[0-9A-Fa-f]{6}$', 'Use a colour like #1B1F2A.')


class Category(models.Model):
    """Two levels only: a category and its subcategories."""

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True)
    parent = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.PROTECT, related_name='children'
    )
    icon = models.ImageField('category image', upload_to='categories/', blank=True)
    icon_alt = models.CharField('image alt text', max_length=150, blank=True, help_text='Describe the picture. Required when an image is added.')
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name_plural = 'categories'
        constraints = [
            models.UniqueConstraint(fields=['parent', 'name'], name='uniq_category_name_per_parent'),
        ]

    def clean(self):
        if self.icon and not self.icon_alt.strip():
            raise ValidationError({'icon_alt': 'Describe the picture (alt text). It is required when an image is added.'})
        if self.parent_id:
            if self.parent_id == self.pk:
                raise ValidationError({'parent': 'A category cannot be its own parent.'})
            if self.parent.parent_id:
                raise ValidationError({'parent': 'Only two levels are allowed: pick a top-level category.'})
            if self.pk and self.children.exists():
                raise ValidationError({'parent': 'This category has subcategories, so it must stay top-level.'})
        else:
            # MySQL treats NULL parents as distinct, so top-level names are checked here.
            clash = Category.objects.filter(parent__isnull=True, name__iexact=self.name)
            if self.pk:
                clash = clash.exclude(pk=self.pk)
            if clash.exists():
                raise ValidationError({'name': 'A top-level category with this name already exists.'})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.parent.name} > {self.name}' if self.parent_id else self.name


class Brand(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    logo = models.ImageField(upload_to='brands/', blank=True)
    logo_alt = models.CharField('logo alt text', max_length=150, blank=True, help_text='Describe the picture. Required when a logo is added.')
    categories = models.ManyToManyField(
        Category, blank=True, related_name='brands', limit_choices_to={'parent__isnull': True},
        help_text='Tick the main categories this brand sells in. Leave all empty if it sells in every category.',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def clean(self):
        if self.logo and not self.logo_alt.strip():
            raise ValidationError({'logo_alt': 'Describe the picture (alt text). It is required when a logo is added.'})

    def sells_in(self, category):
        """True when products in `category` (a main category or one of its sub-categories) may use this brand.
        A brand with no categories ticked sells everywhere."""
        if not self.pk or not self.categories.exists():
            return True
        return self.categories.filter(pk=category.parent_id or category.pk).exists()

    def __str__(self):
        return self.name


class Colour(models.Model):
    name = models.CharField(max_length=50, unique=True)
    hex_code = models.CharField(max_length=7, validators=[hex_validator])

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Size(models.Model):
    name = models.CharField(max_length=30, unique=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class Product(models.Model):
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name='products',
        help_text='Choose the most specific one, for example Earbuds. Main categories that have sub-categories are not listed.',
    )
    brand = models.ForeignKey(
        Brand, null=True, blank=True, on_delete=models.PROTECT, related_name='products',
        help_text='Only brands that sell in the chosen category are listed.',
    )
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, help_text="Filled in from the name. It becomes the product's web address.")
    description = models.TextField(blank=True, help_text='Short text shown on the product page.')
    video_url = models.URLField('video link', max_length=500, blank=True, help_text='Optional link to a product video.')
    # Called is_sponsored inside the code; the admin and the app call it "Featured".
    is_sponsored = models.BooleanField(
        'featured', default=False,
        help_text='Featured products come first in rows and lists and show a "Featured" tag.',
    )
    is_active = models.BooleanField(default=True)  # hide instead of delete: orders keep pointing here
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['category', 'is_active']),
            models.Index(fields=['name']),
        ]

    def clean(self):
        errors = {}
        if self.category_id:
            if self.category.children.exists():
                errors['category'] = (
                    'Pick a sub-category (for example Earbuds). This main category has sub-categories, '
                    'so products go in one of them.'
                )
            elif self.brand_id and not self.brand.sells_in(self.category):
                main = self.category.parent or self.category
                errors['brand'] = (
                    f'{self.brand.name} does not sell in {main.name}. Choose another brand, '
                    f'or add {main.name} to this brand in Catalog > Brands.'
                )
        if errors:
            raise ValidationError(errors)

    @property
    def rating_count(self):
        """Calculated from visible reviews, never stored."""
        return self.reviews.filter(is_visible=True).count()

    @property
    def average_rating(self):
        avg = self.reviews.filter(is_visible=True).aggregate(a=models.Avg('rating'))['a']
        return round(avg, 1) if avg is not None else None

    def __str__(self):
        return self.name


class ProductSpecification(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='specifications')
    name = models.CharField(max_length=100)
    value = models.CharField(max_length=255)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['product', 'name'], name='uniq_spec_name_per_product'),
        ]

    def __str__(self):
        return f'{self.name}: {self.value}'


class ProductVariant(models.Model):
    """One purchasable item. A product without options has a single variant with no colour or size."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    sku = models.CharField('SKU', max_length=50, unique=True, help_text='Your own unique code for this version, for example AIR141-BLK.')
    colour = models.ForeignKey(
        Colour, null=True, blank=True, on_delete=models.PROTECT, related_name='variants',
        help_text='Leave empty if the product has no colour options.',
    )
    size = models.ForeignKey(
        Size, null=True, blank=True, on_delete=models.PROTECT, related_name='variants',
        help_text='Leave empty if the product has no size options.',
    )
    price = models.DecimalField('selling price', max_digits=10, decimal_places=2, help_text='What the customer pays.')
    mrp = models.DecimalField('MRP', max_digits=10, decimal_places=2, help_text='The printed maximum price. It must be the same as or above the selling price.')
    stock = models.PositiveIntegerField(default=0, help_text='How many you have to sell.')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['product', 'colour', 'size']
        constraints = [
            models.UniqueConstraint(fields=['product', 'colour', 'size'], name='uniq_variant_option_per_product'),
            models.CheckConstraint(condition=Q(price__gt=0), name='variant_price_positive'),
            models.CheckConstraint(condition=Q(mrp__gte=F('price')), name='variant_mrp_gte_price'),
        ]

    @property
    def discount_percent(self):
        """Calculated from MRP and price, never stored."""
        if not self.mrp or self.mrp <= self.price:
            return 0
        return int(((self.mrp - self.price) / self.mrp * Decimal(100)).quantize(Decimal('1')))

    def clean(self):
        # MySQL treats NULL colour/size as distinct, so a blank option is checked here.
        if self.product_id:
            clash = ProductVariant.objects.filter(
                product_id=self.product_id, colour=self.colour, size=self.size
            )
            if self.pk:
                clash = clash.exclude(pk=self.pk)
            if clash.exists():
                raise ValidationError('This product already has a variant with the same colour and size.')

    def __str__(self):
        parts = [self.product.name]
        if self.colour_id:
            parts.append(self.colour.name)
        if self.size_id:
            parts.append(self.size.name)
        return ' / '.join(parts)


class ProductImage(models.Model):
    """Shown for every variant when colour is blank, otherwise only when that colour is picked."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    colour = models.ForeignKey(Colour, null=True, blank=True, on_delete=models.PROTECT, related_name='images')
    image = models.ImageField(upload_to='products/')
    alt_text = models.CharField(max_length=150, help_text='Describe the picture, for example "Black wireless headphones, front view".')
    sort_order = models.PositiveIntegerField(default=0)  # the first image is the main one

    class Meta:
        ordering = ['sort_order', 'id']

    def clean(self):
        if self.alt_text is not None and not self.alt_text.strip():
            raise ValidationError({'alt_text': 'Describe the picture (alt text). It is required.'})

    def __str__(self):
        return f'{self.product.name} image {self.sort_order}'


class Bundle(models.Model):
    """'Buy these together to save'. The saving is calculated from the item prices."""

    name = models.CharField(max_length=150)
    bundle_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class BundleItem(models.Model):
    bundle = models.ForeignKey(Bundle, on_delete=models.CASCADE, related_name='items')
    variant = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, related_name='bundle_items')
    quantity = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1)])

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['bundle', 'variant'], name='uniq_variant_per_bundle'),
        ]

    def __str__(self):
        return f'{self.quantity} x {self.variant}'


class Collection(models.Model):
    """A named set of products, used as a banner target or a Home row."""

    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=170, unique=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class CollectionItem(models.Model):
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='collection_items')
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['collection', 'product'], name='uniq_product_per_collection'),
        ]

    def __str__(self):
        return f'{self.collection.name}: {self.product.name}'


class Review(models.Model):
    """A real review links the buyer and the delivered order item they bought.
    A sample review typed in by the admin has neither and only a reviewer name."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name='reviews')
    order_item = models.ForeignKey('orders.OrderItem', null=True, blank=True, on_delete=models.PROTECT, related_name='reviews')
    reviewer_name = models.CharField(max_length=80, blank=True, help_text='Only for admin-entered sample reviews.')
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(max_length=120, blank=True)
    body = models.TextField(blank=True)
    is_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'product'], name='uniq_review_per_user_product'),
            models.CheckConstraint(condition=Q(rating__gte=1, rating__lte=5), name='review_rating_1_to_5'),
            models.CheckConstraint(
                condition=(Q(user__isnull=True, order_item__isnull=True) | Q(user__isnull=False, order_item__isnull=False)),
                name='review_user_and_order_item_together',
            ),
        ]

    @property
    def is_verified_purchase(self):
        return self.order_item_id is not None

    def clean(self):
        if self.order_item_id and not self.user_id:
            raise ValidationError('A review linked to an order item needs a user.')
        if self.user_id and not self.order_item_id:
            raise ValidationError({'order_item': 'Only verified buyers can review: pick the order item they bought.'})
        if not self.user_id and not self.reviewer_name:
            raise ValidationError({'reviewer_name': 'Enter a reviewer name for a sample review.'})
        if self.order_item_id:
            item = self.order_item
            if item.order.user_id != self.user_id:
                raise ValidationError({'order_item': 'This order item belongs to a different customer.'})
            if item.order.status != 'delivered':
                raise ValidationError({'order_item': 'The order must be marked Delivered before it can be reviewed.'})
            if item.variant.product_id != self.product_id:
                raise ValidationError({'order_item': 'This order item is for a different product.'})

    def __str__(self):
        return f'{self.product.name}: {self.rating} stars'


class ProductQuestion(models.Model):
    """Customer asks, admin answers. Only answered questions are shown (calculated)."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='questions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='questions')
    question = models.CharField(max_length=500)
    answer = models.TextField(blank=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_answered(self):
        return bool(self.answer.strip())

    def __str__(self):
        return self.question[:60]


class WishlistItem(models.Model):
    """Saves the product, not a variant. saved_price is the lowest active variant price when saved,
    so a 'Price dropped' label can be calculated against today's lowest price."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wishlist_items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='wishlist_items')
    saved_price = models.DecimalField(max_digits=10, decimal_places=2)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-added_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'product'], name='uniq_wishlist_product_per_user'),
        ]

    def __str__(self):
        return f'{self.user} likes {self.product}'


