from django.http import Http404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.exceptions import ApiError

from .detail import LOW_STOCK_AT, build_detail, get_product_or_none, review_dict, visible_reviews
from .listing import PAGE_SIZE, SORTS, build_listing, category_info, filter_options
from .models import Category, Product, ProductQuestion, Review, WishlistItem
from .queries import card_queryset
from .serializers import ProductCardSerializer, file_url, money

REVIEWS_PER_PAGE = 10
MAX_OPEN_QUESTIONS = 3  # one shopper can have this many unanswered questions on one product


def _product_or_404(slug):
    product = get_product_or_none(slug)
    if product is None:
        raise Http404
    return product


class ProductDetailView(APIView):
    """Everything for one product page in one call. Open to guests."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=OpenApiTypes.OBJECT, tags=['Catalog'])
    def get(self, request, slug):
        return Response(build_detail(_product_or_404(slug), request))


class ProductReviewsView(APIView):
    """All visible reviews of a product, newest first, 10 per page."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        parameters=[OpenApiParameter('page', int, description='Page number, starting at 1.')],
        responses=OpenApiTypes.OBJECT,
        tags=['Catalog'],
    )
    def get(self, request, slug):
        product = _product_or_404(slug)
        reviews = visible_reviews(product)
        raw = request.query_params.get('page', '1')
        page = int(raw) if raw.isdigit() and int(raw) > 0 else 1
        start = (page - 1) * REVIEWS_PER_PAGE
        chunk = list(reviews[start:start + REVIEWS_PER_PAGE + 1])
        return Response({
            'results': [review_dict(r) for r in chunk[:REVIEWS_PER_PAGE]],
            'next_page': page + 1 if len(chunk) > REVIEWS_PER_PAGE else None,
        })


class QuestionInputSerializer(serializers.Serializer):
    question = serializers.CharField(min_length=5, max_length=500, trim_whitespace=True)


class ProductQuestionsView(APIView):
    """A logged-in shopper asks a question. It is shown on the product page once the admin has answered it."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=QuestionInputSerializer, responses={201: OpenApiTypes.OBJECT}, tags=['Catalog'])
    def post(self, request, slug):
        product = _product_or_404(slug)
        data = QuestionInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        open_questions = ProductQuestion.objects.filter(product=product, user=request.user, answer='').count()
        if open_questions >= MAX_OPEN_QUESTIONS:
            raise ApiError('too_many_questions', 'You already have questions waiting for an answer on this product.', 429)
        ProductQuestion.objects.create(product=product, user=request.user, question=data.validated_data['question'])
        return Response({'detail': 'Thanks! Your question will appear here once we have answered it.'}, status=201)


def _cheapest_price(product):
    return min(v.price for v in product.active_variants)


class WishlistView(APIView):
    """The shopper's saved products, newest first. Products that were switched off are left out."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT, tags=['Wishlist'])
    def get(self, request):
        saved = {i.product_id: i for i in WishlistItem.objects.filter(user=request.user)}
        products = list(card_queryset().filter(pk__in=saved.keys()))
        products.sort(key=lambda p: saved[p.id].added_at, reverse=True)
        cards = ProductCardSerializer(products, many=True, context={'request': request}).data
        items = []
        for product, card in zip(products, cards):
            item = saved[product.id]
            cheapest = min(product.active_variants, key=lambda v: (v.price, v.id))
            buyable = [v for v in product.active_variants if v.stock > 0]
            first_buyable = min(buyable, key=lambda v: (v.price, v.id)) if buyable else None
            items.append({
                'product': card,
                'saved_price': money(item.saved_price),
                # "Price dropped": today's lowest price is below the price when it was saved (calculated, not stored)
                'price_dropped': cheapest.price < item.saved_price,
                'only_left': first_buyable.stock if first_buyable and first_buyable.stock <= LOW_STOCK_AT else None,
                # one version only: "Move to cart" can add it directly; otherwise the shopper chooses on the product page
                'single_variant_id': product.active_variants[0].id if len(product.active_variants) == 1 else None,
                'added_at': item.added_at,
            })
        return Response({'count': len(items), 'items': items})


class WishlistItemView(APIView):
    """Save (PUT) or remove (DELETE) one product. Both can be repeated safely."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT, tags=['Wishlist'])
    def put(self, request, slug):
        product = _product_or_404(slug)
        _, created = WishlistItem.objects.get_or_create(
            user=request.user, product=product, defaults={'saved_price': _cheapest_price(product)}
        )
        return Response({'saved': True}, status=201 if created else 200)

    @extend_schema(request=None, responses={204: None}, tags=['Wishlist'])
    def delete(self, request, slug):
        WishlistItem.objects.filter(user=request.user, product__slug=slug).delete()
        return Response(status=204)


LISTING_PARAMS = [
    OpenApiParameter('category', str, description='Category or sub-category slug.'),
    OpenApiParameter('collection', str, description='Collection slug ("See all" of a Home row).'),
    OpenApiParameter('q', str, description='Search words: matched against product, brand and category names.'),
    OpenApiParameter('sort', str, description='relevance (default), price_asc, price_desc, newest or discount.'),
    OpenApiParameter('min_price', str), OpenApiParameter('max_price', str),
    OpenApiParameter('min_discount', int, description='Percent, for example 30.'),
    OpenApiParameter('in_stock', str, description='1 to show only products you can buy now.'),
    OpenApiParameter('brand', str, description='Comma-separated brand slugs.'),
    OpenApiParameter('colour', str, description='Comma-separated colour ids.'),
    OpenApiParameter('size', str, description='Comma-separated size ids.'),
    OpenApiParameter('page', int, description='Page number, starting at 1 (20 products a page).'),
]


class ProductListView(APIView):
    """A page of products for a category, a collection or a search, with sort and filters. Open to guests."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(parameters=LISTING_PARAMS, responses=OpenApiTypes.OBJECT, tags=['Catalog'])
    def get(self, request):
        queryset, category, collection = build_listing(request.query_params)
        raw = request.query_params.get('page', '1')
        page = int(raw) if raw.isdigit() and int(raw) > 0 else 1
        total = queryset.count()
        start = (page - 1) * PAGE_SIZE
        products = list(queryset[start:start + PAGE_SIZE])
        return Response({
            'count': total,
            'page': page,
            'next_page': page + 1 if start + PAGE_SIZE < total else None,
            'category': category_info(category),
            'collection': {'name': collection.name, 'slug': collection.slug} if collection else None,
            'sort': request.query_params.get('sort') or 'relevance',
            'sorts': [{'value': key, 'label': label} for key, label in SORTS.items()],
            'results': ProductCardSerializer(products, many=True, context={'request': request}).data,
        })


class ProductFiltersView(APIView):
    """The choices the Filter panel offers for a list (brands, colours, sizes, price range)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(parameters=LISTING_PARAMS[:3], responses=OpenApiTypes.OBJECT, tags=['Catalog'])
    def get(self, request):
        return Response(filter_options(request.query_params))


class CategoryTreeView(APIView):
    """The main categories with their sub-categories, for the Categories tab. Open to guests."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=OpenApiTypes.OBJECT, tags=['Catalog'])
    def get(self, request):
        mains = Category.objects.filter(parent__isnull=True, is_active=True).prefetch_related('children')
        return Response([
            {
                'id': c.id,
                'name': c.name,
                'slug': c.slug,
                'image': file_url(request, c.icon),
                'image_alt': c.icon_alt,
                'children': [{'name': k.name, 'slug': k.slug} for k in c.children.all() if k.is_active],
            }
            for c in mains
        ])


# ---------- My reviews: rate and review what was bought (login needed) ----------

def _product_summary(product, request):
    image = product.images.order_by('sort_order', 'id').first()
    return {
        'slug': product.slug,
        'name': product.name,
        'image': file_url(request, image.image) if image else None,
        'image_alt': image.alt_text if image else '',
    }


def _review_dict(review):
    return {
        'id': review.id, 'rating': review.rating, 'title': review.title, 'body': review.body,
        'created_at': review.created_at, 'updated_at': review.updated_at, 'is_visible': review.is_visible,
    }


def _delivered_item(user, product):
    """The newest delivered order line of this product bought by this shopper (the proof of purchase), or None."""
    from orders.models import Order, OrderItem

    return (
        OrderItem.objects.filter(order__user=user, order__status=Order.Status.DELIVERED, variant__product=product)
        .order_by('-order__created_at', '-id')
        .first()
    )


class ReviewInputSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    title = serializers.CharField(max_length=120, required=False, allow_blank=True, default='')
    body = serializers.CharField(max_length=2000, required=False, allow_blank=True, default='')


class MyReviewView(APIView):
    """The shopper's own review of a product: read it (GET), write or change it (PUT), or delete it (DELETE).
    Only a shopper whose order with that product has been Delivered can write one (it is then a "verified purchase"),
    and there is one review per product."""

    permission_classes = [IsAuthenticated]

    def _product(self, slug):
        product = Product.objects.filter(slug=slug).first()
        if product is None:
            raise Http404
        return product

    @extend_schema(responses=OpenApiTypes.OBJECT, tags=['Reviews'])
    def get(self, request, slug):
        product = self._product(slug)
        review = Review.objects.filter(user=request.user, product=product).first()
        can_review = review is not None or _delivered_item(request.user, product) is not None
        return Response({
            'product': _product_summary(product, request),
            'can_review': can_review,
            'message': '' if can_review else 'You can review a product after it has been delivered to you.',
            'review': _review_dict(review) if review else None,
        })

    @extend_schema(request=ReviewInputSerializer, responses=OpenApiTypes.OBJECT, tags=['Reviews'])
    def put(self, request, slug):
        product = self._product(slug)
        data = ReviewInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        review = Review.objects.filter(user=request.user, product=product).first()
        if review is None:
            item = _delivered_item(request.user, product)
            if item is None:
                raise ApiError('not_a_buyer', 'You can review a product after it has been delivered to you.', 403)
            review = Review.objects.create(
                product=product, user=request.user, order_item=item,
                rating=values['rating'], title=values['title'].strip(), body=values['body'].strip(),
            )
            return Response({'review': _review_dict(review)}, status=201)
        review.rating, review.title, review.body = values['rating'], values['title'].strip(), values['body'].strip()
        review.save()
        return Response({'review': _review_dict(review)})

    @extend_schema(request=None, responses={204: None}, tags=['Reviews'])
    def delete(self, request, slug):
        Review.objects.filter(user=request.user, product__slug=slug).delete()  # deleting twice is harmless
        return Response(status=204)


class MyReviewsListView(APIView):
    """Everything the shopper has reviewed, newest first (Profile > My reviews)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT, tags=['Reviews'])
    def get(self, request):
        reviews = Review.objects.filter(user=request.user).select_related('product').order_by('-created_at')[:100]
        return Response({
            'results': [{**_review_dict(r), 'product': _product_summary(r.product, request)} for r in reviews],
        })
