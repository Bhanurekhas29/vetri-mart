import mimetypes
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from siteconfig.models import MediaFile


class Command(BaseCommand):
    help = 'Copies every picture in backend/media into the database (for the online server, where pictures live in the database).'

    def handle(self, *args, **options):
        root = Path(settings.MEDIA_ROOT)
        if not root.is_dir():
            self.stderr.write(f'No media folder at {root}.')
            return
        count = 0
        for path in sorted(p for p in root.rglob('*') if p.is_file()):
            name = path.relative_to(root).as_posix()
            MediaFile.objects.update_or_create(
                name=name,
                defaults={'content': path.read_bytes(), 'content_type': mimetypes.guess_type(name)[0] or 'application/octet-stream'},
            )
            count += 1
        self.stdout.write(self.style.SUCCESS(f'{count} pictures saved in the database.'))
