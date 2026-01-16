from django.db import migrations, models


def dedupe_sessions(apps, schema_editor):
    Session = apps.get_model('scheduling', 'Session')
    seen = {}
    to_delete = []
    for session in Session.objects.order_by('studio_id', 'class_type_id', 'starts_at', 'id').iterator():
        key = (session.studio_id, session.class_type_id, session.starts_at)
        if key in seen:
            to_delete.append(session.id)
        else:
            seen[key] = session.id
    if to_delete:
        Session.objects.filter(id__in=to_delete).delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('scheduling', '0003_booking_credit_membership'),
    ]

    operations = [
        migrations.RunPython(dedupe_sessions, noop),
        migrations.AddConstraint(
            model_name='session',
            constraint=models.UniqueConstraint(fields=['studio', 'class_type', 'starts_at'], name='session_unique_per_class_time'),
        ),
    ]
