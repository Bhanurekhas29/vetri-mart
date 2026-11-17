from django.urls import path

from . import views

urlpatterns = [
    path('home/', views.HomeView.as_view()),
    path('home/recent/', views.RecentlyViewedView.as_view()),
    path('search/suggest/', views.SearchSuggestView.as_view()),
    path('search/popular/', views.PopularSearchesView.as_view()),
    path('search/log/', views.SearchLogView.as_view()),
    path('notifications/', views.NotificationListView.as_view()),
    path('notifications/unread-count/', views.UnreadCountView.as_view()),
    path('notifications/read-all/', views.MarkAllReadView.as_view()),
    path('notifications/<int:notification_id>/read/', views.MarkReadView.as_view()),
    path('help/', views.HelpView.as_view()),
    path('pages/<slug:slug>/', views.StaticPageView.as_view()),
    path('onboarding/', views.OnboardingView.as_view()),
]
