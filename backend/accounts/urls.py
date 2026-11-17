from django.urls import path

from . import views

urlpatterns = [
    path('auth/otp/send/', views.SendOTPView.as_view()),
    path('auth/otp/verify/', views.VerifyOTPView.as_view()),
    path('auth/register/', views.RegisterView.as_view()),
    path('auth/login/', views.PasswordLoginView.as_view()),
    path('auth/token/refresh/', views.RefreshView.as_view()),
    path('auth/logout/', views.LogoutView.as_view()),
    path('auth/logout-all/', views.LogoutAllView.as_view()),
    path('auth/password/reset/', views.PasswordResetView.as_view()),
    path('auth/password/set/', views.PasswordSetView.as_view()),
    path('me/', views.MeView.as_view()),
    path('me/photo/', views.MePhotoView.as_view()),
    path('addresses/', views.AddressListCreateView.as_view()),
    path('addresses/<int:pk>/', views.AddressDetailView.as_view()),
]
