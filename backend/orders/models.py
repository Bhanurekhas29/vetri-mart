from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q

from accounts.models import phone_validator, pincode_validator
from catalog.models import ProductVariant

POSITIVE = [MinValueValidator(Decimal('0.01'))]


class CartItem(models.Model):
    """Logged-in users' carts. Guests' carts live on the phone and merge here at login."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cart_items')
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name='cart_items')
    quantity = models.PositiveIntegerField(default=1)
    saved_for_later = models.BooleanField(default=False)
    # The selling price when it was put in the cart, so the cart can say "Price dropped from X".
    # (The cart itself always uses today's price.)
    price_when_added = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'variant'], name='uniq_variant_per_user_cart'),
            models.CheckConstraint(condition=Q(quantity__gte=1), name='cart_quantity_at_least_one'),
        ]

    def __str__(self):
        return f'{self.user} x {self.quantity} {self.variant}'


class CartCoupon(models.Model):
    """The coupon a logged-in shopper has put on their cart (only one at a time). Removed when the order is paid."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cart_coupon')
    coupon = models.ForeignKey('Coupon', on_delete=models.CASCADE, related_name='+')
    applied_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user}: {self.coupon}'


class DeliverySetting(models.Model):
    """A single row: flat delivery fee, free above a threshold. Amounts are placeholders to be chosen."""

    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('40.00'))
    free_delivery_above = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('499.00'))

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'Delivery settings'


class ServiceablePincode(models.Model):
    pincode = models.CharField(max_length=6, unique=True, validators=[pincode_validator])
    delivery_days_min = models.PositiveSmallIntegerField(default=3)
    delivery_days_max = models.PositiveSmallIntegerField(default=5)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(delivery_days_max__gte=F('delivery_days_min')),
                name='pincode_days_max_gte_min',
            ),
        ]

    def __str__(self):
        return self.pincode


class Coupon(models.Model):
    """Times used are counted from orders, not stored. 'Once per user' is enforced when applying."""

    class Kind(models.TextChoices):
        PERCENT = 'percent', 'Percent'
        FLAT = 'flat', 'Flat amount'

    code = models.CharField(max_length=30, unique=True)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    value = models.DecimalField(max_digits=10, decimal_places=2, validators=POSITIVE)
    max_discount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text='Cap for percent coupons.')
    min_order_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        help_text='Minimum items total (after bundle savings, before delivery) needed to use this coupon. 0 means no minimum.',
    )
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    usage_limit = models.PositiveIntegerField(null=True, blank=True, help_text='Total uses allowed. Blank for unlimited.')
    is_active = models.BooleanField(default=True)
    show_in_app = models.BooleanField(
        default=False, help_text='Tick to list this coupon under "Available offers" in the shopper\'s cart. Leave unticked for secret codes.'
    )
    description = models.CharField(
        max_length=120, blank=True,
        help_text='Short line shopper see, for example "Welcome offer: 10% off your first order". Blank: the app writes one from the numbers.',
    )

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(valid_until__gt=F('valid_from')), name='coupon_valid_until_after_from'),
        ]

    def clean(self):
        if self.kind == self.Kind.PERCENT and self.value and self.value > 100:
            raise ValidationError({'value': 'A percent coupon cannot be above 100.'})

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.code


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING_PAYMENT = 'pending_payment', 'Pending payment'
        CONFIRMED = 'confirmed', 'Confirmed'
        SHIPPED = 'shipped', 'Shipped'
        DELIVERED = 'delivered', 'Delivered'
        CANCELLED = 'cancelled', 'Cancelled'

    order_number = models.CharField(max_length=20, unique=True, null=True, blank=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='orders')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_PAYMENT, db_index=True)

    # Delivery address snapshot: copied from the chosen address so later edits never change this order.
    recipient_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=10, validators=[phone_validator])
    pincode = models.CharField(max_length=6, validators=[pincode_validator])
    address_line1 = models.CharField(max_length=200)
    address_line2 = models.CharField(max_length=200, blank=True)
    landmark = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=80)
    state = models.CharField(max_length=80)

    coupon = models.ForeignKey(Coupon, null=True, blank=True, on_delete=models.SET_NULL, related_name='orders')
    coupon_code = models.CharField(max_length=30, blank=True)  # snapshot, survives coupon edits
    coupon_discount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    # Automatic "Buy these together to save" saving, taken off the items total at checkout.
    bundle_discount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)  # amount actually charged

    courier_name = models.CharField(max_length=80, blank=True)
    tracking_number = models.CharField(max_length=60, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', '-created_at'])]
        constraints = [
            models.CheckConstraint(condition=Q(total_amount__gte=0), name='order_total_not_negative'),
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.order_number:
            self.order_number = f'VM-{self.pk:06d}'
            super().save(update_fields=['order_number'])

    @property
    def mrp_total(self):
        return sum((i.mrp * i.quantity for i in self.items.all()), Decimal('0.00'))

    @property
    def price_total(self):
        return sum((i.price * i.quantity for i in self.items.all()), Decimal('0.00'))

    @property
    def product_discount(self):
        """Calculated: total MRP minus total price paid for the items."""
        return self.mrp_total - self.price_total

    @property
    def is_refunded(self):
        return self.payments.filter(status=Payment.Status.REFUNDED).exists()

    def record_status(self, by=None, note=''):
        """Log the current status in the tracking timeline."""
        return OrderStatusEvent.objects.create(order=self, status=self.status, changed_by=by, note=note)

    def __str__(self):
        return self.order_number or f'Order {self.pk}'


class OrderStatusEvent(models.Model):
    """One row per status change: this is the tracking timeline and the audit trail."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='events')
    status = models.CharField(max_length=20, choices=Order.Status.choices)
    changed_at = models.DateTimeField(auto_now_add=True)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['changed_at', 'id']

    def __str__(self):
        return f'{self.order} {self.status}'


class OrderItem(models.Model):
    """Everything here is a snapshot of what the customer bought and paid."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    variant = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, related_name='order_items')
    product_name = models.CharField(max_length=200)
    colour = models.CharField(max_length=50, blank=True)
    size = models.CharField(max_length=30, blank=True)
    sku = models.CharField(max_length=50)
    image_url = models.URLField(max_length=500, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)  # price paid per unit
    mrp = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()

    class Meta:
        ordering = ['id']  # always the order the items were added: the first one names the order in lists
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gte=1), name='order_item_quantity_at_least_one'),
            models.CheckConstraint(condition=Q(price__gt=0), name='order_item_price_positive'),
            models.CheckConstraint(condition=Q(mrp__gte=F('price')), name='order_item_mrp_gte_price'),
            models.UniqueConstraint(fields=['order', 'variant'], name='uniq_variant_per_order'),
        ]

    def __str__(self):
        return f'{self.quantity} x {self.product_name}'


class Payment(models.Model):
    """One row per payment attempt. Card details are never stored."""

    class Status(models.TextChoices):
        CREATED = 'created', 'Created'
        PAID = 'paid', 'Paid'
        FAILED = 'failed', 'Failed'
        REFUNDED = 'refunded', 'Refunded'

    class Method(models.TextChoices):
        UPI = 'upi', 'UPI'
        CARD = 'card', 'Card'
        NETBANKING = 'netbanking', 'Net banking'
        WALLET = 'wallet', 'Wallet'

    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name='payments')
    razorpay_order_id = models.CharField(max_length=60, unique=True)
    razorpay_payment_id = models.CharField(max_length=60, unique=True, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=12, choices=Method.choices, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.CREATED)
    failure_reason = models.CharField(max_length=200, blank=True)
    refund_id = models.CharField(max_length=60, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name='payment_amount_positive'),
        ]

    def __str__(self):
        return f'{self.order} {self.status}'


# Written on the timeline when starting a new checkout replaces an earlier unpaid order. The shopper is not notified.
REPLACED_NOTE = 'Replaced by a new checkout'
