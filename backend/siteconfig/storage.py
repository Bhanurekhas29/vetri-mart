"""Storage helpers.

MediaAwareStaticFilesStorage lets the admin theme show the uploaded brand logo.
The theme only knows how to show logos from the static folder ({% static 'path' %}). The Brand logo is an
upload, so it lives in the media folder. A path that starts with __media__/ is turned into the media link.

DatabaseMediaStorage keeps uploaded pictures in the database instead of on disk, for a host (such as
Render's free plan) whose disk is wiped on every restart. It is switched on with MEDIA_IN_DATABASE=True.
"""

import mimetypes

from django.conf import settings
from django.contrib.staticfiles.storage import StaticFilesStorage
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible

from .constants import MEDIA_MARKER


class MediaAwareStaticFilesStorage(StaticFilesStorage):
    def url(self, name):
        if name and name.startswith(MEDIA_MARKER):
            return settings.MEDIA_URL + name[len(MEDIA_MARKER):]
        return super().url(name)


@deconstructible
class DatabaseMediaStorage(Storage):
    def _model(self):
        from .models import MediaFile  # imported late: the storage is created before the apps are ready

        return MediaFile

    def _save(self, name, content):
        data = content.read()
        self._model().objects.update_or_create(
            name=name, defaults={'content': data, 'content_type': mimetypes.guess_type(name)[0] or 'application/octet-stream'}
        )
        return name

    def _open(self, name, mode='rb'):
        return ContentFile(bytes(self._model().objects.get(name=name).content), name=name)

    def exists(self, name):
        return self._model().objects.filter(name=name).exists()

    def delete(self, name):
        if name:
            self._model().objects.filter(name=name).delete()

    def size(self, name):
        return len(self._model().objects.get(name=name).content)

    def url(self, name):
        return settings.MEDIA_URL + name

    def listdir(self, path):
        return [], []
