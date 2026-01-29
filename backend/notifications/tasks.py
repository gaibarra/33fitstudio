from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task
def send_booking_reminder(booking_id, hours_before=24):
    """Send reminder email for an upcoming booking"""
    from scheduling.models import Booking
    
    booking = Booking.objects.filter(
        id=booking_id, 
        status__in=['booked', 'attended']
    ).select_related('user', 'session__class_type', 'session__studio').first()
    
    if not booking:
        return 'booking-not-found'
    
    user = booking.user
    session = booking.session
    studio_name = session.studio.name if session.studio else '33 F/T Studio'
    class_name = session.class_type.name if session.class_type else 'Clase'
    
    # Format session time
    local_time = session.starts_at.strftime('%A %d de %B a las %H:%M')
    
    subject = f"📅 Recordatorio: {class_name} en {hours_before}h"
    greeting = user.full_name or user.email
    
    body = (
        f"Hola {greeting},\n\n"
        f"Te recordamos que tienes una clase reservada:\n\n"
        f"🏋️ {class_name}\n"
        f"📅 {local_time}\n"
        f"📍 {studio_name}\n\n"
        f"¡Te esperamos puntual!\n\n"
        f"Si no puedes asistir, cancela con anticipación desde tu portal."
    )
    
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@33ftstudio.local')
    try:
        send_mail(subject, body, from_email, [user.email], fail_silently=False)
        logger.info(f"Reminder sent to {user.email} for booking {booking_id}")
        return 'sent'
    except Exception as e:
        logger.error(f"Failed to send reminder for booking {booking_id}: {e}")
        return f'error: {str(e)}'


@shared_task
def schedule_reminders():
    """Schedule reminders for upcoming bookings - run periodically via celery beat"""
    from scheduling.models import Booking
    from django_celery_beat.models import PeriodicTask  # Optional
    
    now = timezone.now()
    
    # Bookings in the next 24 hours (send 24h reminder)
    window_24h_start = now + timedelta(hours=23)
    window_24h_end = now + timedelta(hours=25)
    upcoming_24h = Booking.objects.filter(
        status='booked',
        session__starts_at__gte=window_24h_start,
        session__starts_at__lt=window_24h_end
    ).values_list('id', flat=True)
    
    for booking_id in upcoming_24h:
        send_booking_reminder.delay(str(booking_id), hours_before=24)
    
    # Bookings in the next 2 hours (send 2h reminder)
    window_2h_start = now + timedelta(hours=1, minutes=45)
    window_2h_end = now + timedelta(hours=2, minutes=15)
    upcoming_2h = Booking.objects.filter(
        status='booked',
        session__starts_at__gte=window_2h_start,
        session__starts_at__lt=window_2h_end
    ).values_list('id', flat=True)
    
    for booking_id in upcoming_2h:
        send_booking_reminder.delay(str(booking_id), hours_before=2)
    
    return f'Scheduled: {len(upcoming_24h)} x 24h + {len(upcoming_2h)} x 2h reminders'


@shared_task
def send_onboarding_email(user_id):
    """Send welcome email to new users"""
    from users.models import User

    user = User.objects.filter(id=user_id).select_related('studio').first()
    if not user:
        return 'missing-user'

    studio_name = user.studio.name if user.studio else '33 F/T Studio'
    dashboard_url = f"{settings.FRONTEND_URL.rstrip('/')}/portal/dashboard"
    subject = f"🎉 ¡Bienvenido a {studio_name}!"

    greeting = user.full_name or user.email
    body = (
        f"Hola {greeting},\n\n"
        f"Tu cuenta en {studio_name} ya está activa.\n\n"
        f"🏋️ Explora nuestras clases y horarios\n"
        f"📅 Reserva tu próxima sesión\n"
        f"💳 Gestiona tu membresía y créditos\n\n"
        f"Accede a tu portal aquí: {dashboard_url}\n\n"
        f"¡Nos vemos en el estudio!\n\n"
        f"El equipo de {studio_name}"
    )

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@33ftstudio.local')
    try:
        send_mail(subject, body, from_email, [user.email], fail_silently=False)
        logger.info(f"Onboarding email sent to {user.email}")
        return 'sent'
    except Exception as e:
        logger.error(f"Failed to send onboarding email to {user_id}: {e}")
        return f'error: {str(e)}'


@shared_task
def send_booking_confirmation(booking_id):
    """Send confirmation email when a booking is created"""
    from scheduling.models import Booking
    
    booking = Booking.objects.filter(id=booking_id).select_related(
        'user', 'session__class_type', 'session__studio', 'session__instructor'
    ).first()
    
    if not booking:
        return 'booking-not-found'
    
    user = booking.user
    session = booking.session
    studio_name = session.studio.name if session.studio else '33 F/T Studio'
    class_name = session.class_type.name if session.class_type else 'Clase'
    instructor = session.instructor.full_name if session.instructor else 'Staff'
    
    local_time = session.starts_at.strftime('%A %d de %B a las %H:%M')
    
    subject = f"✅ Reserva confirmada: {class_name}"
    greeting = user.full_name or user.email
    
    body = (
        f"Hola {greeting},\n\n"
        f"Tu reserva ha sido confirmada:\n\n"
        f"🏋️ {class_name}\n"
        f"👤 Con: {instructor}\n"
        f"📅 {local_time}\n"
        f"📍 {studio_name}\n\n"
        f"Te enviaremos un recordatorio antes de tu clase.\n\n"
        f"¡Nos vemos pronto!"
    )
    
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@33ftstudio.local')
    try:
        send_mail(subject, body, from_email, [user.email], fail_silently=False)
        logger.info(f"Confirmation sent to {user.email} for booking {booking_id}")
        return 'sent'
    except Exception as e:
        logger.error(f"Failed to send confirmation for booking {booking_id}: {e}")
        return f'error: {str(e)}'


@shared_task
def send_cancellation_email(booking_id, user_email, user_name, class_name, session_time, studio_name):
    """Send cancellation confirmation email"""
    subject = f"❌ Reserva cancelada: {class_name}"
    greeting = user_name or user_email
    
    body = (
        f"Hola {greeting},\n\n"
        f"Tu reserva ha sido cancelada:\n\n"
        f"🏋️ {class_name}\n"
        f"📅 {session_time}\n"
        f"📍 {studio_name}\n\n"
        f"Si esto fue un error, puedes volver a reservar desde tu portal.\n\n"
        f"¡Te esperamos pronto!"
    )
    
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@33ftstudio.local')
    try:
        send_mail(subject, body, from_email, [user_email], fail_silently=False)
        logger.info(f"Cancellation email sent to {user_email}")
        return 'sent'
    except Exception as e:
        logger.error(f"Failed to send cancellation email to {user_email}: {e}")
        return f'error: {str(e)}'


@shared_task
def send_session_update_notification(session_id, change_type='update'):
    """Notify all booked users when a session is modified or cancelled"""
    from scheduling.models import Session, Booking
    
    session = Session.objects.filter(id=session_id).select_related(
        'class_type', 'studio', 'instructor'
    ).first()
    
    if not session:
        return 'session-not-found'
    
    bookings = Booking.objects.filter(
        session=session,
        status__in=['booked', 'waitlist']
    ).select_related('user')
    
    if not bookings.exists():
        return 'no-bookings'
    
    studio_name = session.studio.name if session.studio else '33 F/T Studio'
    class_name = session.class_type.name if session.class_type else 'Clase'
    local_time = session.starts_at.strftime('%A %d de %B a las %H:%M')
    
    if change_type == 'cancelled':
        subject = f"⚠️ Clase cancelada: {class_name}"
        message_body = (
            f"Lamentamos informarte que la clase de {class_name} "
            f"programada para {local_time} ha sido cancelada.\n\n"
            f"Tu crédito ha sido devuelto automáticamente.\n"
            f"Te invitamos a reservar otra sesión desde tu portal."
        )
    else:
        subject = f"📝 Actualización: {class_name}"
        message_body = (
            f"Te informamos que hubo cambios en la clase:\n\n"
            f"🏋️ {class_name}\n"
            f"📅 {local_time}\n"
            f"📍 {studio_name}\n\n"
            f"Revisa los detalles en tu portal."
        )
    
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@33ftstudio.local')
    sent_count = 0
    
    for booking in bookings:
        user = booking.user
        greeting = user.full_name or user.email
        body = f"Hola {greeting},\n\n{message_body}"
        
        try:
            send_mail(subject, body, from_email, [user.email], fail_silently=False)
            sent_count += 1
        except Exception as e:
            logger.error(f"Failed to notify {user.email} about session {session_id}: {e}")
    
    return f'notified: {sent_count} users'

