from django.urls import path

from . import views

urlpatterns = [
    path('cart/', views.CartView.as_view()),
    path('cart/items/', views.CartItemsView.as_view()),
    path('cart/items/<int:item_id>/save/', views.CartItemSaveView.as_view()),
    path('cart/coupon/', views.CartCouponView.as_view()),
    path('coupons/available/', views.AvailableCouponsView.as_view()),
    path('cart/preview/', views.GuestCartPreviewView.as_view()),
    path('cart/merge/', views.CartMergeView.as_view()),
    path('cart/items/<int:item_id>/', views.CartItemView.as_view()),
    path('checkout/summary/', views.CheckoutSummaryView.as_view()),
    path('orders/', views.OrdersView.as_view()),
    path('orders/<int:order_id>/', views.OrderDetailView.as_view()),
    path('orders/<int:order_id>/invoice-link/', views.InvoiceLinkView.as_view()),
    path('orders/invoice/<str:token>/', views.InvoicePdfView.as_view()),
    path('orders/<int:order_id>/cancel/', views.OrderCancelView.as_view()),
    path('orders/<int:order_id>/payment/verify/', views.PaymentVerifyView.as_view()),
    path('orders/<int:order_id>/payment/failed/', views.PaymentFailedView.as_view()),
    path('orders/<int:order_id>/payment/retry/', views.PaymentRetryView.as_view()),
    path('delivery/check/', views.DeliveryCheckView.as_view()),
]
