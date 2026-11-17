from django.db.models import Q
from django.http import Http404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, serializers
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.listing import scope_queryset
from catalog.models import Category
from catalog.queries import card_queryset
from catalog.serializers import ProductCardSerializer, file_url

from .home import build_home
from accounts.exceptions import ApiError

from .models import FAQ, ContactInfo, Notification, OnboardingSlide, SearchTerm, StaticPage
from .serializers import HomeResponseSerializer, OnboardingSlideSerializer


class HomeView(APIView):
    """The whole Home page in one call. Open to guests."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=HomeResponseSerializer, tags=['Home'])
    def get(self, request):
        return Response(build_home(request))


class RecentlyViewedView(APIView):
    """Fresh product cards for the slugs the phone remembers as "recently viewed".

    The phone keeps only the slugs; price, stock and picture always come from here, so they are never stale.
    Products that were switched off or deleted are left out. Order follows the slugs sent. At most 10.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        parameters=[OpenApiParameter('slugs', str, description='Comma-separated product slugs, most recent first.')],
        responses=ProductCardSerializer(many=True),
        tags=['Home'],
    )
    def get(self, request):
        slugs = []
        for slug in request.query_params.get('slugs', '').split(','):
            slug = slug.strip()
            if slug and slug not in slugs:
                slugs.append(slug)
        slugs = slugs[:10]
        by_slug = {p.slug: p for p in card_queryset().filter(slug__in=slugs)}
        cards = [by_slug[s] for s in slugs if s in by_slug]
        return Response(ProductCardSerializer(cards, many=True, context={'request': request}).data)


class OnboardingView(generics.ListAPIView):
    """The first-launch slides. Managed in the admin panel."""

    serializer_class = OnboardingSlideSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    pagination_class = None

    def get_queryset(self):
        return OnboardingSlide.objects.filter(is_active=True)

    @extend_schema(tags=['Content'])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


# ---------- Search: suggestions, popular searches, and counting ----------

SUGGEST_MIN_CHARS = 2
POPULAR_SHOWN = 8


def _starts_a_word(field, text):
    """The field starts with the text, or has a word that starts with it ("wired earphones" matches "ear")."""
    return Q(**{f'{field}__istartswith': text}) | Q(**{f'{field}__icontains': ' ' + text})


class SearchSuggestView(APIView):
    """Suggestions while the shopper types: a few products (with a picture and their category) and categories.
    Names are matched from the start of a word. Nothing is counted here. Open to guests."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(parameters=[OpenApiParameter('q', str, description='What has been typed so far (2 or more letters).')], responses=OpenApiTypes.OBJECT, tags=['Search'])
    def get(self, request):
        text = SearchTerm.normalise(request.query_params.get('q', ''))
        if len(text) < SUGGEST_MIN_CHARS:
            return Response({'products': [], 'categories': []})
        products = list(
            card_queryset().select_related('category')
            .filter(_starts_a_word('name', text) | _starts_a_word('brand__name', text))
            .order_by('-is_sponsored', 'name')[:5]
        )
        categories = list(
            Category.objects.filter(is_active=True).filter(_starts_a_word('name', text)).select_related('parent').order_by('parent_id', 'name')[:3]
        )
        return Response({
            'products': [
                {
                    'slug': p.slug,
                    'name': p.name,
                    'category': p.category.name,
                    'image': file_url(request, p.card_images[0].image) if p.card_images else None,
                    'image_alt': p.card_images[0].alt_text if p.card_images else '',
                }
                for p in products
            ],
            'categories': [
                {'slug': c.slug, 'name': c.name, 'parent': c.parent.name if c.parent_id else None}
                for c in categories
            ],
        })


class PopularSearchesView(APIView):
    """The most searched words that still find something. Empty until people have searched. Open to guests."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=OpenApiTypes.OBJECT, tags=['Search'])
    def get(self, request):
        terms = []
        for term in SearchTerm.objects.order_by('-count', '-last_searched_at')[: POPULAR_SHOWN * 3]:
            if scope_queryset(None, None, term.term).exists():  # never offer a word that finds nothing
                terms.append(term.term)
            if len(terms) == POPULAR_SHOWN:
                break
        return Response({'terms': terms})


class SearchLogSerializer(serializers.Serializer):
    q = serializers.CharField(max_length=100)


class SearchLogView(APIView):
    """The app calls this when a shopper submits a search. Only searches that find something are counted,
    so 'Popular searches' never fills up with typos. Open to guests (limited to 60 a minute)."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'search_log'

    @extend_schema(request=SearchLogSerializer, responses={204: None}, tags=['Search'])
    def post(self, request):
        data = SearchLogSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        term = SearchTerm.normalise(data.validated_data['q'])
        if len(term) >= 2 and scope_queryset(None, None, term).exists():
            SearchTerm.record(term)
        return Response(status=204)


# ---------- Notifications (login needed) ----------

NOTIFICATIONS_PER_PAGE = 20


def _notification_dict(n):
    return {
        'id': n.id,
        'kind': n.kind,
        'title': n.title,
        'message': n.message,
        'order_id': n.order_id,
        'order_number': n.order.order_number if n.order_id else None,
        'is_read': n.is_read,
        'created_at': n.created_at,
    }


class NotificationListView(APIView):
    """The shopper's notifications, newest first, 20 a page. Written automatically when an order or payment changes."""

    permission_classes = [IsAuthenticated]

    @extend_schema(parameters=[OpenApiParameter('page', int, description='Page number, starting at 1.')], responses=OpenApiTypes.OBJECT, tags=['Notifications'])
    def get(self, request):
        mine = Notification.objects.filter(user=request.user)
        raw = request.query_params.get('page', '1')
        page = int(raw) if raw.isdigit() and int(raw) > 0 else 1
        start = (page - 1) * NOTIFICATIONS_PER_PAGE
        chunk = list(mine.select_related('order')[start:start + NOTIFICATIONS_PER_PAGE + 1])
        return Response({
            'unread_count': mine.filter(is_read=False).count(),
            'next_page': page + 1 if len(chunk) > NOTIFICATIONS_PER_PAGE else None,
            'results': [_notification_dict(n) for n in chunk[:NOTIFICATIONS_PER_PAGE]],
        })


class UnreadCountView(APIView):
    """Just the number on the bell."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT, tags=['Notifications'])
    def get(self, request):
        return Response({'unread_count': Notification.objects.filter(user=request.user, is_read=False).count()})


class MarkReadView(APIView):
    """Mark one notification as read (safe to repeat)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={204: None}, tags=['Notifications'])
    def post(self, request, notification_id):
        updated = Notification.objects.filter(pk=notification_id, user=request.user).update(is_read=True)
        if not updated and not Notification.objects.filter(pk=notification_id, user=request.user).exists():
            raise ApiError('not_found', 'That notification does not exist.', 404)
        return Response(status=204)


class MarkAllReadView(APIView):
    """Mark every notification as read."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT, tags=['Notifications'])
    def post(self, request):
        updated = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'updated': updated, 'unread_count': 0})


# ---------- Help and the text pages (open to guests) ----------

class HelpView(APIView):
    """The Help screen: the active FAQs in the admin's order, and the support contact details."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=OpenApiTypes.OBJECT, tags=['Content'])
    def get(self, request):
        contact = ContactInfo.load()
        return Response({
            'faqs': [{'id': f.id, 'question': f.question, 'answer': f.answer} for f in FAQ.objects.filter(is_active=True)],
            'contact': {'support_email': contact.support_email, 'support_phone': contact.support_phone, 'hours': contact.hours},
        })


class StaticPageView(APIView):
    """A text page managed in the admin (Terms, Privacy, About). Blank line = new paragraph; a line starting with "# " is a heading."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=OpenApiTypes.OBJECT, tags=['Content'])
    def get(self, request, slug):
        page = StaticPage.objects.filter(slug=slug).first()
        if page is None:
            raise Http404
        return Response({'slug': page.slug, 'title': page.title, 'body': page.body, 'updated_at': page.updated_at})
