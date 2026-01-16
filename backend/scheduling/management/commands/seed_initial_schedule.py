import datetime
from zoneinfo import ZoneInfo
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from catalog.models import ClassType
from scheduling.models import Session
from studios.models import Studio

# Weekly pattern derived from provided grid
# Times in 24h local time
WEEKLY_PATTERN = [
    # (weekday, hour, minute, class_name)
    (0, 8, 0, 'FIT TRAINING'),
    (0, 9, 10, 'BODY JUMP'),
    (0, 16, 30, 'JUMP KIDS'),
    (0, 18, 0, 'BODY JUMP'),
    (0, 19, 10, 'FIT TRAINING'),
    (1, 8, 0, 'BURN'),
    (1, 9, 10, 'FIT TRAINING'),
    (1, 18, 0, 'FIT TRAINING'),
    (1, 19, 10, 'BURN'),
    (2, 8, 0, 'FIT TRAINING'),
    (2, 9, 10, 'BURN'),
    (2, 16, 30, 'JUMP KIDS'),
    (2, 18, 0, 'BURN'),
    (2, 19, 10, 'FIT TRAINING'),
    (3, 8, 0, 'BODY JUMP'),
    (3, 9, 10, 'FIT TRAINING'),
    (3, 18, 0, 'FIT TRAINING'),
    (3, 19, 10, 'BODY JUMP'),
    (4, 8, 0, 'FIT TRAINING'),
    (4, 9, 10, 'BODY JUMP'),
    (4, 16, 30, 'JUMP KIDS'),
    (4, 18, 0, 'BODY JUMP'),
    (5, 9, 10, 'RUSH'),
]

DEFAULT_DURATION_MINUTES = 50
DEFAULT_CAPACITY = 20
DEFAULT_TZ = 'America/Mexico_City'


class Command(BaseCommand):
    help = 'Genera sesiones futuras basado en un patrón semanal inicial.'

    def add_arguments(self, parser):
        parser.add_argument('--studio-id', type=str, required=True, help='ID del studio')
        parser.add_argument('--weeks', type=int, default=4, help='Cantidad de semanas a generar (desde la fecha de inicio)')
        parser.add_argument('--start-date', type=str, help='Fecha de inicio (YYYY-MM-DD). Si no se indica, se toma el próximo lunes.')
        parser.add_argument('--tz', type=str, default=DEFAULT_TZ, help='Zona horaria para las sesiones')
        parser.add_argument('--clear-from-date', type=str, help='Borrar sesiones existentes del studio a partir de esta fecha (YYYY-MM-DD) antes de generar')

    def handle(self, *args, **options):
        studio_id = options['studio_id']
        weeks = options['weeks']
        start_date_str = options.get('start_date')
        tzname = options.get('tz') or DEFAULT_TZ
        try:
            tz = ZoneInfo(tzname)
        except Exception as exc:
            raise CommandError(f'Zona horaria inválida: {tzname}') from exc

        try:
            studio = Studio.objects.get(id=studio_id)
        except Studio.DoesNotExist as exc:
            raise CommandError(f'Studio {studio_id} no encontrado') from exc

        if start_date_str:
            start_date = datetime.date.fromisoformat(start_date_str)
        else:
            today = timezone.localdate()
            start_date = today + datetime.timedelta(days=(7 - today.weekday()) % 7)  # próximo lunes

        clear_from = options.get('clear_from_date')
        if clear_from:
            clear_date = datetime.date.fromisoformat(clear_from)
            start_dt = datetime.datetime.combine(clear_date, datetime.time.min, tzinfo=tz)
            deleted, _ = Session.objects.filter(studio=studio, starts_at__gte=start_dt).delete()
            self.stdout.write(self.style.WARNING(f'Sesiones eliminadas desde {clear_date}: {deleted}'))

        created = 0
        skipped = 0

        for week in range(weeks):
            for weekday, hour, minute, class_name in WEEKLY_PATTERN:
                day = start_date + datetime.timedelta(days=week * 7 + weekday)
                starts_at = datetime.datetime.combine(day, datetime.time(hour=hour, minute=minute, tzinfo=tz))

                class_type, _ = ClassType.objects.get_or_create(
                    studio=studio,
                    name=class_name,
                    defaults={'description': class_name.title(), 'duration_minutes': DEFAULT_DURATION_MINUTES},
                )

                if Session.objects.filter(studio=studio, class_type=class_type, starts_at=starts_at).exists():
                    skipped += 1
                    continue

                Session.objects.create(
                    studio=studio,
                    class_type=class_type,
                    starts_at=starts_at,
                    capacity=DEFAULT_CAPACITY,
                    status=Session.SessionStatus.SCHEDULED,
                )
                created += 1

        self.stdout.write(self.style.SUCCESS(f'Sesiones creadas: {created}, omitidas (ya existían): {skipped}'))
