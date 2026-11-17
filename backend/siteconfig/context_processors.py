def brand(request):
    """Makes the Brand settings available to admin templates as `brand`."""
    try:
        from .models import BrandSettings

        return {'brand': BrandSettings.objects.filter(pk=1).first()}
    except Exception:
        return {'brand': None}


def admin_alerts(request):
    """What needs the admin's attention, for the bell in the admin top bar.

    Each kind (unanswered product questions, orders to ship, shipped orders to mark delivered) has a count of what is
    still waiting, and how many of those are NEW since this admin last pressed "Mark all as read". The red number on the
    bell counts only the new ones; nothing is hidden or resolved by pressing the button. Staff only, admin pages only.
    """
    user = getattr(request, 'user', None)
    if not (user and user.is_authenticated and user.is_staff and request.path.startswith('/admin/')):
        return {}
    try:
        from django.urls import reverse

        from catalog.models import ProductQuestion
        from orders.models import Order, OrderStatusEvent

        seen = user.alerts_seen_at  # None = never pressed: everything is new

        def events_after(status):
            """Orders now in `status` whose move into it happened after the admin last looked."""
            events = OrderStatusEvent.objects.filter(status=status)
            if seen:
                events = events.filter(changed_at__gt=seen)
            return Order.objects.filter(status=status, id__in=events.values('order_id')).count()

        items = []

        waiting_q = ProductQuestion.objects.filter(answer='')
        new_q = waiting_q.filter(created_at__gt=seen) if seen else waiting_q
        if waiting_q.exists():
            items.append({
                'icon': 'far fa-comments', 'count': waiting_q.count(), 'new': new_q.count(),
                'label': 'Product questions to answer',
                'url': reverse('admin:catalog_productquestion_changelist') + '?answered_at__isempty=1',
            })

        to_ship = Order.objects.filter(status=Order.Status.CONFIRMED).count()
        if to_ship:
            items.append({
                'icon': 'fas fa-box', 'count': to_ship, 'new': events_after(Order.Status.CONFIRMED), 'label': 'Orders to ship',
                'url': reverse('admin:orders_order_changelist') + '?status__exact=confirmed',
            })
        to_deliver = Order.objects.filter(status=Order.Status.SHIPPED).count()
        if to_deliver:
            items.append({
                'icon': 'fas fa-truck', 'count': to_deliver, 'new': events_after(Order.Status.SHIPPED), 'label': 'Shipped orders to mark delivered',
                'url': reverse('admin:orders_order_changelist') + '?status__exact=shipped',
            })
        latest = [
            {
                'text': q.question[:90], 'product': q.product.name, 'is_new': (not seen) or q.created_at > seen,
                'url': reverse('admin:catalog_productquestion_change', args=[q.pk]),
            }
            for q in waiting_q.select_related('product').order_by('-created_at')[:3]
        ]
        new_total = sum(i['new'] for i in items)
        return {'admin_alerts': {
            'new_total': new_total,
            'badge': '99+' if new_total > 99 else new_total,
            'waiting_total': sum(i['count'] for i in items),
            'items': items,
            'latest_questions': latest,
            'mark_read_url': reverse('mark-alerts-read'),
        }}
    except Exception:
        return {}


def admin_stats(request):
    """The numbers on the admin Dashboard cards. Only worked out on the Dashboard page itself."""
    if request.path != '/admin/':
        return {}
    user = getattr(request, 'user', None)
    if not (user and user.is_authenticated and user.is_staff):
        return {}
    try:
        from datetime import timedelta

        from django.db.models import Sum
        from django.urls import reverse
        from django.utils import timezone

        from accounts.models import User
        from catalog.models import Product, ProductQuestion, ProductVariant
        from orders.models import Order

        now = timezone.localtime()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month = today.replace(day=1)
        paid_states = [Order.Status.CONFIRMED, Order.Status.SHIPPED, Order.Status.DELIVERED]
        paid = Order.objects.filter(status__in=paid_states)

        def rupees(value):
            value = value or 0
            return f'₹{value:,.0f}'

        orders_url = reverse('admin:orders_order_changelist')
        low = ProductVariant.objects.filter(is_active=True, product__is_active=True, stock__lte=5)
        customers = User.objects.filter(is_staff=False)
        cards = [
            {'label': 'Orders today', 'value': paid.filter(created_at__gte=today).count(), 'note': f'{paid.filter(created_at__gte=today - timedelta(days=1), created_at__lt=today).count()} yesterday', 'icon': 'fas fa-shopping-bag', 'url': orders_url, 'tone': 'navy'},
            {'label': 'Revenue this month', 'value': rupees(paid.filter(created_at__gte=month).aggregate(t=Sum('total_amount'))['t']), 'note': f'{rupees(paid.filter(created_at__gte=today).aggregate(t=Sum("total_amount"))["t"])} today', 'icon': 'fas fa-rupee-sign', 'url': orders_url, 'tone': 'green'},
            {'label': 'Orders to ship', 'value': Order.objects.filter(status=Order.Status.CONFIRMED).count(), 'note': 'Confirmed, paid', 'icon': 'fas fa-box', 'url': orders_url + '?status__exact=confirmed', 'tone': 'orange'},
            {'label': 'Out for delivery', 'value': Order.objects.filter(status=Order.Status.SHIPPED).count(), 'note': 'Shipped, not delivered', 'icon': 'fas fa-truck', 'url': orders_url + '?status__exact=shipped', 'tone': 'navy'},
            {'label': 'Questions to answer', 'value': ProductQuestion.objects.filter(answer='').count(), 'note': 'From shoppers', 'icon': 'far fa-comments', 'url': reverse('admin:catalog_productquestion_changelist') + '?answered_at__isempty=1', 'tone': 'orange'},
            {'label': 'Low or out of stock', 'value': low.count(), 'note': 'Versions with 5 or fewer', 'icon': 'fas fa-exclamation-triangle', 'url': reverse('admin:catalog_productvariant_changelist'), 'tone': 'red'},
            {'label': 'Customers', 'value': customers.count(), 'note': f'{customers.filter(created_at__gte=now - timedelta(days=7)).count()} new this week', 'icon': 'fas fa-users', 'url': reverse('admin:accounts_user_changelist'), 'tone': 'navy'},
            {'label': 'Live products', 'value': Product.objects.filter(is_active=True).count(), 'note': f'{Product.objects.filter(is_active=False).count()} switched off', 'icon': 'fas fa-boxes', 'url': reverse('admin:catalog_product_changelist'), 'tone': 'green'},
        ]
        return {'admin_stat_cards': cards}
    except Exception:
        return {}
