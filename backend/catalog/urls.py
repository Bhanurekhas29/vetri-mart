from django.urls import path

from . import views

urlpatterns = [
    path('wishlist/', views.WishlistView.as_view()),
    path('wishlist/<slug:slug>/', views.WishlistItemView.as_view()),
    path('products/', views.ProductListView.as_view()),
    path('products/filters/', views.ProductFiltersView.as_view()),
    path('categories/', views.CategoryTreeView.as_view()),
    path('products/<slug:slug>/', views.ProductDetailView.as_view()),
    path('products/<slug:slug>/reviews/', views.ProductReviewsView.as_view()),
    path('products/<slug:slug>/my-review/', views.MyReviewView.as_view()),
    path('me/reviews/', views.MyReviewsListView.as_view()),
    path('products/<slug:slug>/questions/', views.ProductQuestionsView.as_view()),
]
