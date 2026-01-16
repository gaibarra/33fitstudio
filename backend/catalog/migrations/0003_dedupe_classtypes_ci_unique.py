from django.db import migrations, models
from django.db.models.functions import Lower


def dedupe(apps, schema_editor):
    ClassType = apps.get_model('catalog', 'ClassType')
    Session = apps.get_model('scheduling', 'Session')

    by_studio = {}
    for ct in ClassType.objects.order_by('studio_id', 'id'):
        key = (ct.studio_id, ct.name.strip().lower())
        if key in by_studio:
            canonical_id = by_studio[key]
            Session.objects.filter(class_type_id=ct.id).update(class_type_id=canonical_id)
            ct.delete()
        else:
            by_studio[key] = ct.id


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('catalog', '0002_seed_products'),
        ('scheduling', '0004_dedupe_and_unique_sessions'),
    ]

    operations = [
        migrations.RunPython(dedupe, noop),
        migrations.AddConstraint(
            model_name='classtype',
            constraint=models.UniqueConstraint(Lower('name'), 'studio', name='class_type_name_ci_unique'),
        ),
    ]
