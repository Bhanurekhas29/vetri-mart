from django import forms
from django.contrib import admin, messages
from django.db import transaction
from django.utils import timezone
from django.utils.html import format_html

from catalog.models import ProductVariant

from .models import (
    CartItem, Coupon, DeliverySetting, Order, OrderItem, OrderStatusEvent,
    Payment, ServiceablePincode,
)


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ('user', 'variant', 'quantity', 'saved_for_later', 'added_at')
    list_filter = ('saved_for_later',)
    search_fields = ('user__email', 'variant__sku')
    raw_id_fields = ('user', 'variant')


@admin.register(DeliverySetting)
class DeliverySettingAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'delivery_fee', 'free_delivery_above')

    def has_add_permission(self, request):
        return not DeliverySetting.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ServiceablePincode)
class ServiceablePincodeAdmin(admin.ModelAdmin):
    list_display = ('pincode', 'delivery_days_min', 'delivery_days_max', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('pincode',)


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    """Coupon codes. A shopper can use each code once (cancelled orders do not count) and puts one coupon on an order.
    A percent coupon can have a cap (max discount); free delivery is judged before the coupon."""

    list_display = ('code', 'kind', 'value', 'max_discount', 'min_order_amount', 'valid_from', 'valid_until', 'times_used', 'usage_limit', 'is_active')
    list_filter = ('kind', 'is_active')
    search_fields = ('code',)

    @admin.display(description='Times used')
    def times_used(self, obj):
        return obj.orders.filter(status__in=('confirmed', 'shipped', 'delivered')).count()


class OrderItemInline(admin.TabularInline):
    """What was bought: a short, readable table (the copy taken when the order was placed)."""

    model = OrderItem
    extra = 0
    can_delete = False
    verbose_name = 'item'
    verbose_name_plural = 'Items in this order'
    fields = ('picture', 'item', 'quantity', 'price_each', 'line_total')
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description='')
    def picture(self, obj):
        if not obj.image_url:
            return '-'
        return format_html('<img src="{}" alt="" style="height:44px;width:44px;object-fit:contain;border-radius:6px;">', obj.image_url)

    @admin.display(description='Item')
    def item(self, obj):
        version = ' / '.join(x for x in (obj.colour, obj.size) if x)
        return format_html(
            '<strong>{}</strong><br><span style="color:#6b7280">{}</span><br><span style="color:#6b7280;font-size:12px;word-break:break-all">SKU {}</span>',
            obj.product_name, version or 'No colour or size', obj.sku,
        )

    @admin.display(description='Price each')
    def price_each(self, obj):
        return f'₹{obj.price:,.2f}'

    @admin.display(description='Total')
    def line_total(self, obj):
        return f'₹{obj.price * obj.quantity:,.2f}'


class PaymentInlineForm(forms.ModelForm):
    """The only things the admin changes on a payment: marking a paid one as Refunded, and the Razorpay refund id."""

    class Meta:
        model = Payment
        fields = ['status', 'refund_id']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        current = self.instance.status if self.instance.pk else Payment.Status.CREATED
        allowed = [current] + ([Payment.Status.REFUNDED] if current == Payment.Status.PAID else [])
        self.fields['status'].choices = [(v, l) for v, l in Payment.Status.choices if v in allowed]
        self.fields['status'].help_text = 'After you refund the money in Razorpay, choose Refunded. The customer is then told.' if current == Payment.Status.PAID else ''
        self.fields['refund_id'].required = False
        self.fields['refund_id'].help_text = 'Razorpay refund id (starts with rfnd_). Optional, for your records.'


class PaymentInline(admin.StackedInline):
    """One block per payment attempt. Everything is read-only except marking a paid payment as Refunded."""

    model = Payment
    form = PaymentInlineForm
    extra = 0
    can_delete = False
    verbose_name = 'payment'
    verbose_name_plural = 'Payments (refund here)'
    fields = ('status', 'refund_id', 'method_label', 'amount_paid', 'razorpay_payment_id', 'razorpay_order_id', 'failure_reason', 'refunded_at', 'created_at')
    readonly_fields = ('method_label', 'amount_paid', 'razorpay_payment_id', 'razorpay_order_id', 'failure_reason', 'refunded_at', 'created_at')

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description='Method')
    def method_label(self, obj):
        return obj.get_method_display() or '-'

    @admin.display(description='Amount')
    def amount_paid(self, obj):
        return f'₹{obj.amount:,.2f}'


class EventInline(admin.TabularInline):
    model = OrderStatusEvent
    extra = 0
    can_delete = False
    verbose_name = 'step'
    verbose_name_plural = 'Timeline'
    fields = ('status_label', 'changed_at', 'changed_by', 'note')
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description='Status')
    def status_label(self, obj):
        return obj.get_status_display()


# What the admin may move an order to. An order becomes Confirmed only when its payment is verified (never by hand),
# and Delivered and Cancelled are final.
NEXT_STATUSES = {
    Order.Status.PENDING_PAYMENT: [Order.Status.CANCELLED],
    Order.Status.CONFIRMED: [Order.Status.SHIPPED, Order.Status.CANCELLED],
    Order.Status.SHIPPED: [Order.Status.DELIVERED, Order.Status.CANCELLED],
    Order.Status.DELIVERED: [],
    Order.Status.CANCELLED: [],
}
CANCELLED_BY_ADMIN = 'Cancelled by admin'


class OrderAdminForm(forms.ModelForm):
    class Meta:
        model = Order
        fields = ['status', 'courier_name', 'tracking_number']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        current = self.instance.status if self.instance.pk else Order.Status.PENDING_PAYMENT
        allowed = [current, *NEXT_STATUSES.get(current, [])]
        self.fields['status'].choices = [(value, label) for value, label in Order.Status.choices if value in allowed]
        self.fields['status'].help_text = (
            'Only the next steps that make sense are offered. An order is confirmed by its payment, not by hand. '
            'Delivered and Cancelled orders cannot be changed.'
        )

    def clean(self):
        data = super().clean()
        if data.get('status') == Order.Status.SHIPPED and not (data.get('courier_name') or '').strip():
            self.add_error('courier_name', 'Enter the courier name before marking the order Shipped.')
        return data


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    """Admin moves the order along (Shipped with courier and tracking, then Delivered) or cancels it.
    Everything else is a read-only snapshot."""

    form = OrderAdminForm
    list_display = ('order_number', 'user', 'status', 'total_amount', 'created_at')
    list_filter = ('status',)
    search_fields = ('order_number', 'user__email', 'tracking_number', 'phone')
    inlines = [OrderItemInline, PaymentInline, EventInline]
    readonly_fields = (
        'order_number', 'user', 'recipient_name', 'phone', 'pincode', 'address_line1',
        'address_line2', 'landmark', 'city', 'state', 'coupon', 'coupon_code',
        'coupon_discount', 'bundle_discount', 'delivery_fee', 'total_amount', 'created_at', 'updated_at',
    )
    fieldsets = (
        (None, {'fields': ('order_number', 'user', 'status')}),
        ('Courier', {'fields': ('courier_name', 'tracking_number')}),
        ('Delivery address (snapshot)', {'fields': ('recipient_name', 'phone', 'pincode', 'address_line1', 'address_line2', 'landmark', 'city', 'state')}),
        ('Amounts', {'fields': ('coupon', 'coupon_code', 'coupon_discount', 'bundle_discount', 'delivery_fee', 'total_amount')}),
        ('Dates', {'fields': ('created_at', 'updated_at')}),
    )

    def has_add_permission(self, request):
        return False  # orders are created by the app at checkout

    def has_delete_permission(self, request, obj=None):
        return False

    def save_formset(self, request, form, formset, change):
        if formset.model is not Payment:
            return super().save_formset(request, form, formset, change)
        # Marking a payment Refunded stamps the time; the customer's notification and email follow from that change.
        for payment in formset.save(commit=False):
            if payment.status == Payment.Status.REFUNDED and not payment.refunded_at:
                payment.refunded_at = timezone.now()
            payment.save()
        formset.save_m2m()

    @transaction.atomic
    def save_model(self, request, obj, form, change):
        was = form.initial.get('status') if change else None
        super().save_model(request, obj, form, change)
        if not (change and 'status' in form.changed_data):
            return

        if obj.status != Order.Status.CANCELLED:
            obj.record_status(by=request.user)
            return

        # Cancelled by the admin
        obj.record_status(by=request.user, note=CANCELLED_BY_ADMIN)
        paid = obj.payments.filter(status=Payment.Status.PAID).exists()
        if was == Order.Status.CONFIRMED:
            # the stock was reduced when the payment was confirmed: put it back
            items = list(obj.items.all())
            variants = {v.id: v for v in ProductVariant.objects.select_for_update().filter(pk__in=[i.variant_id for i in items])}
            for item in items:
                variant = variants[item.variant_id]
                variant.stock += item.quantity
                variant.save(update_fields=['stock'])
            messages.info(request, 'The items were put back in stock.')
        elif was == Order.Status.SHIPPED:
            messages.warning(request, 'This order had already shipped, so the stock was NOT changed. If the items come back, add them back under Catalog > Product variants.')
        if paid:
            messages.warning(request, f'The customer paid {obj.total_amount}. Refund it in Razorpay, then mark the payment as Refunded in the Payments box below.')
