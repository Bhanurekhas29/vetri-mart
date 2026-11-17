from decimal import Decimal

from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.exceptions import ApiError
from catalog.models import ProductVariant, Review
from catalog.serializers import money

from django.http import HttpResponse

from . import checkout, invoice
from . import pricing
from .cart import GUEST_MAX_LINES, build_cart, build_guest_cart
from .models import REPLACED_NOTE, CartCoupon, CartItem, DeliverySetting, Order, ServiceablePincode


class DeliveryCheckView(APIView):
    """Can we deliver to this pincode, and how long does it take? Open to guests.

    The list of pincodes and delivery days is kept by the admin (Orders > Serviceable pincodes).
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        parameters=[OpenApiParameter('pincode', str, description='A 6-digit pincode.')],
        responses=OpenApiTypes.OBJECT,
        tags=['Orders'],
    )
    def get(self, request):
        pincode = request.query_params.get('pincode', '').strip()
        if len(pincode) != 6 or not pincode.isdigit():
            raise ApiError('invalid_pincode', 'Enter a valid 6-digit pincode.', 400)

        settings = DeliverySetting.load()
        row = ServiceablePincode.objects.filter(pincode=pincode, is_active=True).first()
        if row is None:
            message = 'Sorry, we do not deliver to this pincode yet.'
        elif row.delivery_days_min == row.delivery_days_max:
            message = f'Delivery in {row.delivery_days_min} days'
        else:
            message = f'Delivery in {row.delivery_days_min} to {row.delivery_days_max} days'
        return Response({
            'pincode': pincode,
            'deliverable': row is not None,
            'days_min': row.delivery_days_min if row else None,
            'days_max': row.delivery_days_max if row else None,
            'message': message,
            'delivery_fee': money(settings.delivery_fee),
            'free_delivery_above': money(settings.free_delivery_above),
        })


class AddToCartSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=99, default=1)


class QuantitySerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=99)


class CartView(APIView):
    """The shopper's cart with prices, stock warnings and totals."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT, tags=['Cart'])
    def get(self, request):
        return Response(build_cart(request.user, request))


class CartItemsView(APIView):
    """Add one version to the cart. Adding the same version again adds to its quantity (never above its stock)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=AddToCartSerializer, responses=OpenApiTypes.OBJECT, tags=['Cart'])
    @transaction.atomic
    def post(self, request):
        data = AddToCartSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        variant = (
            ProductVariant.objects.select_for_update()
            .select_related('product__category')
            .filter(pk=data.validated_data['variant_id'], is_active=True, product__is_active=True, product__category__is_active=True)
            .first()
        )
        if variant is None:
            raise ApiError('unavailable', 'This product is not available any more.', 404)
        if variant.stock <= 0:
            raise ApiError('out_of_stock', 'Sorry, this item is out of stock.', 400)

        wanted = data.validated_data['quantity']
        line = CartItem.objects.filter(user=request.user, variant=variant).first()
        current = line.quantity if line and not line.saved_for_later else 0
        new_quantity = current + wanted
        limited = new_quantity > variant.stock
        new_quantity = min(new_quantity, variant.stock)

        if line is None:
            CartItem.objects.create(user=request.user, variant=variant, quantity=new_quantity, price_when_added=variant.price)
        else:
            line.quantity = new_quantity
            line.saved_for_later = False
            if current == 0:
                line.price_when_added = variant.price  # coming back from "saved for later": start from today's price
            line.save()

        cart = build_cart(request.user, request)
        cart['added'] = {
            'variant_id': variant.id,
            'quantity': new_quantity,
            'limited_by_stock': limited,
            'message': f'Only {variant.stock} available, so the quantity was set to {new_quantity}.' if limited else '',
        }
        return Response(cart, status=201)


class CartItemView(APIView):
    """Change the quantity of a cart line (PATCH) or remove it (DELETE)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=QuantitySerializer, responses=OpenApiTypes.OBJECT, tags=['Cart'])
    @transaction.atomic
    def patch(self, request, item_id):
        line = CartItem.objects.select_related('variant').filter(pk=item_id, user=request.user).first()
        if line is None:
            raise ApiError('not_found', 'That item is not in your cart.', 404)
        data = QuantitySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        quantity = data.validated_data['quantity']
        stock = line.variant.stock
        if stock <= 0:
            raise ApiError('out_of_stock', 'Sorry, this item is out of stock.', 400)
        if quantity > stock:
            raise ApiError('not_enough_stock', f'Only {stock} available.', 400)
        line.quantity = quantity
        line.save(update_fields=['quantity'])
        return Response(build_cart(request.user, request))

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT, tags=['Cart'])
    def delete(self, request, item_id):
        CartItem.objects.filter(pk=item_id, user=request.user).delete()  # removing twice is harmless
        return Response(build_cart(request.user, request))


class GuestLineSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=99)
    saved = serializers.BooleanField(default=False)  # "saved for later"


class GuestCartSerializer(serializers.Serializer):
    lines = GuestLineSerializer(many=True, max_length=GUEST_MAX_LINES)


def _merged_lines(data):
    """Same version listed twice: add the quantities."""
    merged = {}
    for line in data.validated_data['lines']:
        quantity, saved = merged.get(line['variant_id'], (0, True))
        merged[line['variant_id']] = (min(quantity + line['quantity'], 99), saved and line['saved'])
    return [(vid, quantity, saved) for vid, (quantity, saved) in merged.items()]


class GuestCartPreviewView(APIView):
    """Prices a guest's cart. The phone keeps the list of versions and quantities; this answers with today's prices,
    stock and totals in the same shape as the logged-in cart. Nothing is saved. Open to guests."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=GuestCartSerializer, responses=OpenApiTypes.OBJECT, tags=['Cart'])
    def post(self, request):
        data = GuestCartSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(build_guest_cart(_merged_lines(data), request))


class CartMergeView(APIView):
    """After login: the guest cart from the phone is added to the shopper's cart.
    The same version adds to the quantity (never above its stock). Sold-out or switched-off versions are skipped."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=GuestCartSerializer, responses=OpenApiTypes.OBJECT, tags=['Cart'])
    @transaction.atomic
    def post(self, request):
        data = GuestCartSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        skipped = 0
        for variant_id, quantity, saved in _merged_lines(data):
            variant = (
                ProductVariant.objects.select_for_update()
                .select_related('product__category')
                .filter(pk=variant_id, is_active=True, product__is_active=True, product__category__is_active=True, stock__gt=0)
                .first()
            )
            if variant is None:
                skipped += 1
                continue
            line = CartItem.objects.filter(user=request.user, variant=variant).first()
            if line is None:
                CartItem.objects.create(
                    user=request.user, variant=variant, quantity=min(quantity, variant.stock),
                    price_when_added=variant.price, saved_for_later=saved,
                )
            elif saved:
                continue  # already in this account's cart or saved list: keep it as it is
            else:
                current = line.quantity if not line.saved_for_later else 0
                line.quantity = min(current + quantity, variant.stock)
                line.saved_for_later = False
                if current == 0:
                    line.price_when_added = variant.price
                line.save()
        cart = build_cart(request.user, request)
        cart['skipped'] = skipped
        return Response(cart)


class CartItemSaveView(APIView):
    """Move a cart line to "Saved for later" (POST) or back into the cart (DELETE).
    A saved line is left out of the totals and the cart count."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT, tags=['Cart'])
    def post(self, request, item_id):
        line = CartItem.objects.filter(pk=item_id, user=request.user).first()
        if line is None:
            raise ApiError('not_found', 'That item is not in your cart.', 404)
        if not line.saved_for_later:
            line.saved_for_later = True
            line.save(update_fields=['saved_for_later'])
        return Response(build_cart(request.user, request))

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT, tags=['Cart'])
    def delete(self, request, item_id):
        line = CartItem.objects.select_related('variant').filter(pk=item_id, user=request.user).first()
        if line is None:
            raise ApiError('not_found', 'That item is not in your cart.', 404)
        if line.saved_for_later:
            line.saved_for_later = False
            line.quantity = max(1, min(line.quantity, line.variant.stock)) if line.variant.stock > 0 else line.quantity
            line.price_when_added = line.variant.price  # back in the cart: compare against today's price from now on
            line.save()
        return Response(build_cart(request.user, request))


# ---------- Checkout and payment (login needed) ----------

class CheckoutSummaryView(APIView):
    """Everything the checkout screen shows: items, the chosen (or default) address, delivery estimate and price details.
    `can_pay` is false, with the reasons in `blockers`, until the order can really be placed."""

    permission_classes = [IsAuthenticated]

    @extend_schema(parameters=[OpenApiParameter('address_id', int, description='Optional: a saved address. Default address if left out.')], responses=OpenApiTypes.OBJECT, tags=['Checkout'])
    def get(self, request):
        raw = request.query_params.get('address_id', '')
        return Response(checkout.checkout_summary(request.user, request, int(raw) if raw.isdigit() else None))


class CreateOrderSerializer(serializers.Serializer):
    address_id = serializers.IntegerField(min_value=1)


ORDERS_PER_PAGE = 20


class OrdersView(APIView):
    """GET: the shopper's orders, newest first, 20 a page (`filter` = all, active or delivered).
    POST: place the order from the cart ("Pending payment") and get what is needed to open Razorpay's payment page."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter('filter', str, description='all (default), active (not yet delivered) or delivered.'),
            OpenApiParameter('page', int, description='Page number, starting at 1.'),
        ],
        responses=OpenApiTypes.OBJECT,
        tags=['Orders'],
    )
    def get(self, request):
        # unpaid orders that a newer checkout silently replaced are not shown (the admin still sees them)
        orders = Order.objects.filter(user=request.user).exclude(events__note=REPLACED_NOTE).prefetch_related('items__variant', 'payments')
        kind = request.query_params.get('filter', 'all')
        if kind == 'active':
            orders = orders.filter(status__in=checkout.ACTIVE_STATUSES)
        elif kind == 'delivered':
            orders = orders.filter(status=Order.Status.DELIVERED)
        elif kind != 'all':
            raise ApiError('invalid_filter', 'Filter must be all, active or delivered.', 400)
        raw = request.query_params.get('page', '1')
        page = int(raw) if raw.isdigit() and int(raw) > 0 else 1
        start = (page - 1) * ORDERS_PER_PAGE
        chunk = list(orders[start:start + ORDERS_PER_PAGE + 1])
        reviewed = set(Review.objects.filter(user=request.user).values_list('product_id', flat=True))
        return Response({
            'next_page': page + 1 if len(chunk) > ORDERS_PER_PAGE else None,
            'results': [checkout.order_card(o, request, reviewed) for o in chunk[:ORDERS_PER_PAGE]],
        })

    @extend_schema(request=CreateOrderSerializer, responses={201: OpenApiTypes.OBJECT}, tags=['Orders'])
    def post(self, request):
        data = CreateOrderSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order, razorpay = checkout.create_order(request.user, data.validated_data['address_id'], request)
        return Response({'order': checkout.order_dict(order, request), 'razorpay': razorpay}, status=201)


class PaymentVerifySerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField(max_length=60)
    razorpay_payment_id = serializers.CharField(max_length=60)
    razorpay_signature = serializers.CharField(max_length=200)


class PaymentVerifyView(APIView):
    """After the shopper pays: the app sends what Razorpay returned. The signature is checked here; only then is
    the order confirmed and the stock reduced. Safe to repeat."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=PaymentVerifySerializer, responses=OpenApiTypes.OBJECT, tags=['Orders'])
    def post(self, request, order_id):
        data = PaymentVerifySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        order, outcome = checkout.confirm_payment(request.user, order_id, v['razorpay_order_id'], v['razorpay_payment_id'], v['razorpay_signature'])
        if outcome == 'sold_out':
            raise ApiError('out_of_stock_after_payment', 'One of your items just sold out. Your payment will be refunded.', 409)
        if outcome == 'cancelled':
            raise ApiError('order_not_payable', 'This order was cancelled before the payment arrived. It will be refunded.', 409)
        return Response({'order': checkout.order_dict(order, request)})


class PaymentFailedSerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField(max_length=60)
    reason = serializers.CharField(max_length=300, required=False, allow_blank=True, default='')


class PaymentFailedView(APIView):
    """The payment page reported that the payment failed. Records it (and the shopper is notified); the order stays
    "Pending payment" so it can be retried."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=PaymentFailedSerializer, responses={204: None}, tags=['Orders'])
    def post(self, request, order_id):
        data = PaymentFailedSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        checkout.mark_payment_failed(request.user, order_id, data.validated_data['razorpay_order_id'], data.validated_data['reason'])
        return Response(status=204)


class PaymentRetryView(APIView):
    """Start a new payment attempt for an order that is still "Pending payment"."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT, tags=['Orders'])
    def post(self, request, order_id):
        order, razorpay = checkout.retry_payment(request.user, order_id)
        return Response({'order': checkout.order_dict(order, request), 'razorpay': razorpay}, status=201)


class OrderDetailView(APIView):
    """One of the shopper's orders: items, address, price breakdown, tracking timeline."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT, tags=['Orders'])
    def get(self, request, order_id):
        order = Order.objects.filter(pk=order_id, user=request.user).prefetch_related('items__variant__product', 'events', 'payments').first()
        if order is None:
            raise ApiError('not_found', 'That order does not exist.', 404)
        return Response({'order': checkout.order_dict(order, request)})


class OrderCancelView(APIView):
    """Cancel an order that is still Pending payment or Confirmed."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT, tags=['Orders'])
    def post(self, request, order_id):
        order = checkout.cancel_order(request.user, order_id)
        order = Order.objects.prefetch_related('items__variant__product', 'events', 'payments').get(pk=order.pk)
        return Response({'order': checkout.order_dict(order, request)})


class InvoiceLinkView(APIView):
    """A private link to the invoice PDF, valid for 5 minutes. The app opens it in the phone's browser or PDF viewer."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT, tags=['Orders'])
    def get(self, request, order_id):
        order = Order.objects.filter(pk=order_id, user=request.user).first()
        if order is None:
            raise ApiError('not_found', 'That order does not exist.', 404)
        if not invoice.can_invoice(order):
            raise ApiError('no_invoice', 'An invoice is available once your payment is confirmed.', 400)
        url = request.build_absolute_uri(f'/api/v1/orders/invoice/{invoice.make_link_token(order)}/')
        return Response({'url': url, 'expires_in_seconds': invoice.LINK_MAX_AGE_SECONDS})


class InvoicePdfView(APIView):
    """The invoice PDF itself. No login: the private link IS the permission (it names one order and expires)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={200: OpenApiTypes.BINARY}, tags=['Orders'])
    def get(self, request, token):
        order = invoice.order_from_link_token(token)
        response = HttpResponse(invoice.invoice_pdf(order), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="Invoice-{order.order_number}.pdf"'
        response['Cache-Control'] = 'private, no-store'
        return response


class CouponCodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=30)


class CartCouponView(APIView):
    """Put a coupon on the cart (POST) or take it off (DELETE). One coupon at a time: a new code replaces the old one.
    Checked now (found, active, dates, minimum order, usage limit, once per shopper) and again every time the cart is shown."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=CouponCodeSerializer, responses=OpenApiTypes.OBJECT, tags=['Cart'])
    @transaction.atomic
    def post(self, request):
        data = CouponCodeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        coupon = pricing.find_coupon(data.validated_data['code'])
        if coupon is None:
            raise ApiError('coupon_invalid', 'That coupon code is not valid.', 400)
        base = Decimal(build_cart(request.user, request)['summary']['items_total'])
        if base <= 0:
            raise ApiError('cart_empty', 'Add something to your cart before using a coupon.', 400)
        discount, code, message = pricing.check_coupon(coupon, request.user, base)
        if code:
            raise ApiError(code, message, 400)
        CartCoupon.objects.update_or_create(user=request.user, defaults={'coupon': coupon})
        return Response(build_cart(request.user, request))

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT, tags=['Cart'])
    def delete(self, request):
        CartCoupon.objects.filter(user=request.user).delete()  # removing twice is harmless
        return Response(build_cart(request.user, request))
