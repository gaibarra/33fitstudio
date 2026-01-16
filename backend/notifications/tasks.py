from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from scheduling.models import Booking

@shared_task
def send_booking_reminder(booking_id):
    # Placeholder for integration; intentionally no mock content
    Booking.objects.filter(id=booking_id).update()
    return 'queued'

@shared_task
def schedule_reminders():
    now = timezone.now()
    upcoming = Booking.objects.filter(status='booked', session__starts_at__gt=now)
    # In a real implementation, enqueue reminders 24h and 2h before
    return upcoming.count()


@shared_task
def send_onboarding_email(user_id):
    from users.models import User  # Lazy import to avoid circular dependency

    user = User.objects.filter(id=user_id).select_related('studio').first()
    if not user:
        return 'missing-user'

    studio_name = user.studio.name if user.studio else '33 F/T Studio'
    dashboard_url = f"{settings.FRONTEND_URL.rstrip('/')}/portal"
    subject = f"Bienvenido a {studio_name}"

    greeting = user.full_name or user.email
    body = (
        f"Hola {greeting},\n\n"
        f"Tu cuenta en {studio_name} ya está activa.\n"
        f"Explora horarios, reserva clases y administra tu membresía ingresando en {dashboard_url}.\n\n"
        "Si no solicitaste este registro, responde a este mensaje para ayudarte."
    )

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@33ftstudio.local')
    send_mail(subject, body, from_email, [user.email], fail_silently=True)
    return 'sent'
