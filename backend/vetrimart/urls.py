"""
URL configuration for vetrimart project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


@require_POST
@staff_member_required
def mark_alerts_read(request):
    """The bell's "Mark all as read": the alerts that exist now stop counting as new for this admin."""
    request.user.alerts_seen_at = timezone.now()
    request.user.save(update_fields=['alerts_seen_at'])
    return JsonResponse({'ok': True})


def health(request):
    """Lets the app (and you) check that the server is reachable."""
    return JsonResponse({'status': 'ok', 'service': 'vetrimart'})


urlpatterns = [
    path('admin/mark-alerts-read/', mark_alerts_read, name='mark-alerts-read'),
    path('admin/', admin.site.urls),
    path('api/v1/health/', health),
    path('api/v1/', include('accounts.urls')),
    path('api/v1/', include('content.urls')),
    path('api/v1/', include('catalog.urls')),
    path('api/v1/', include('orders.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
]

# Online (Render): pictures live in the database and are served from there.
if settings.MEDIA_IN_DATABASE:
    from django.urls import re_path

    from siteconfig.views import serve_media

    urlpatterns += [re_path(r'^media/(?P<path>.+)$', serve_media)]
# While developing, Django itself hands the uploaded pictures to the phone.
elif settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
