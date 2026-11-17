import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from orders.models import ServiceablePincode

DEFAULT_FILE = Path(__file__).resolve().parents[2] / 'data' / 'tamil_nadu_pincodes.csv'


class Command(BaseCommand):
    help = (
        'Adds the pincodes from a list to Serviceable pincodes (Admin > Orders). The built-in list is every Tamil Nadu '
        'pincode (India Post). A pincode that is already in the admin keeps its own delivery days and active setting.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--file', default=str(DEFAULT_FILE), help='CSV with a "pincode" column (default: all Tamil Nadu).')
        parser.add_argument('--days', default='3-5', help='Delivery days "min-max" for most places (default 3-5).')
        parser.add_argument('--fast-prefixes', default='600', help='Pincodes starting with these (comma separated) get --fast-days. Default 600 = Chennai.')
        parser.add_argument('--fast-days', default='2-3', help='Delivery days "min-max" for the fast prefixes (default 2-3).')
        parser.add_argument('--dry-run', action='store_true', help='Only count, change nothing.')

    @staticmethod
    def _days(text, label):
        try:
            low, high = (int(x) for x in text.split('-'))
        except ValueError:
            raise CommandError(f'{label} must look like 2-3.') from None
        if not 0 < low <= high:
            raise CommandError(f'{label}: the first number must be at least 1 and not above the second.')
        return low, high

    def handle(self, *args, **options):
        path = Path(options['file'])
        if not path.is_file():
            raise CommandError(f'File not found: {path}')
        days = self._days(options['days'], '--days')
        fast_days = self._days(options['fast_days'], '--fast-days')
        fast_prefixes = tuple(p.strip() for p in options['fast_prefixes'].split(',') if p.strip())

        with path.open(encoding='utf-8-sig', newline='') as f:
            pincodes = sorted({row['pincode'].strip() for row in csv.DictReader(f) if row.get('pincode')})
        bad = [p for p in pincodes if not (p.isdigit() and len(p) == 6)]
        if bad:
            raise CommandError(f'These are not 6-digit pincodes: {bad[:5]}')

        existing = set(ServiceablePincode.objects.filter(pincode__in=pincodes).values_list('pincode', flat=True))
        new = [p for p in pincodes if p not in existing]
        self.stdout.write(f'{len(pincodes)} pincodes in the list, {len(existing)} already in the admin, {len(new)} to add.')
        if options['dry_run']:
            self.stdout.write('Dry run: nothing changed.')
            return

        rows = []
        for p in new:
            low, high = fast_days if fast_prefixes and p.startswith(fast_prefixes) else days
            rows.append(ServiceablePincode(pincode=p, delivery_days_min=low, delivery_days_max=high, is_active=True))
        ServiceablePincode.objects.bulk_create(rows, batch_size=500, ignore_conflicts=True)
        self.stdout.write(self.style.SUCCESS(f'Added {len(rows)} pincodes. Total now: {ServiceablePincode.objects.count()}.'))
