"""Adds a few demo "Popular searches" so a fresh demo does not show an empty block.

Safe to run again: it only adds terms that are missing and never changes counts you or shoppers have built up.
Edit or delete terms in the admin (Content > Search terms). Real searches add to these counts.
"""

from django.core.management.base import BaseCommand

from content.models import SearchTerm

TERMS = {
    'earbuds': 42, 'neckband': 31, 'gel pen': 27, 'sony': 24, 'boat': 22, 'headphones': 18, 'ball pen': 12, 'airdopes': 9,
}


class Command(BaseCommand):
    help = 'Add a few demo popular searches.'

    def handle(self, *args, **options):
        added = 0
        for term, count in TERMS.items():
            _, created = SearchTerm.objects.get_or_create(term=term, defaults={'count': count})
            added += created
        self.stdout.write(self.style.SUCCESS(f'Added {added} demo search terms.'))
