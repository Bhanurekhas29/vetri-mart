from django.http import Http404, HttpResponse
from django.views.decorators.http import require_GET

from .models import MediaFile


@require_GET
def serve_media(request, path):
    """Hands a picture kept in the database to the app (used when MEDIA_IN_DATABASE=True)."""
    try:
        item = MediaFile.objects.only('content', 'content_type', 'updated_at').get(name=path)
    except MediaFile.DoesNotExist:
        raise Http404('No such picture') from None
    response = HttpResponse(bytes(item.content), content_type=item.content_type or 'application/octet-stream')
    response['Cache-Control'] = 'public, max-age=86400'
    return response
