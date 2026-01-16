from django.db import migrations


PRODUCTS = [
    {
        'type': 'drop_in',
        'name': 'Clase muestra',
        'description': 'Clase individual de prueba',
        'price_cents': 5000,
        'meta': {'credits': 1},
    },
    {
        'type': 'drop_in',
        'name': 'Clase suelta',
        'description': 'Clase individual',
        'price_cents': 10000,
        'meta': {'credits': 1},
    },
    {
        'type': 'package',
        'name': '3 clases por semana',
        'description': '12 clases en el mes',
        'price_cents': 60000,
        'meta': {'credits': 12, 'expiry_days': 30},
    },
    {
        'type': 'package',
        'name': '10 clases Jump - 10 clases fit',
        'description': 'Paquete combinado de 20 clases',
        'price_cents': 80000,
        'meta': {'credits': 20, 'expiry_days': 90},
    },
    {
        'type': 'package',
        'name': '15 clases Jump - 15 clases fit',
        'description': 'Paquete combinado de 30 clases',
        'price_cents': 98000,
        'meta': {'credits': 30, 'expiry_days': 120},
    },
    {
        'type': 'membership',
        'name': '3 meses Jump y Fit',
        'description': 'Acceso ilimitado por 3 meses para jump y fit',
        'price_cents': 315000,
        'meta': {'duration_days': 90},
    },
]


def forwards(apps, schema_editor):
    Product = apps.get_model('catalog', 'Product')
    Studio = apps.get_model('studios', 'Studio')
    for studio in Studio.objects.all():
        for payload in PRODUCTS:
            Product.objects.update_or_create(
                studio=studio,
                type=payload['type'],
                name=payload['name'],
                defaults={
                    'description': payload.get('description'),
                    'price_cents': payload['price_cents'],
                    'currency': 'MXN',
                    'is_active': True,
                    'meta': payload.get('meta', {}),
                },
            )


def backwards(apps, schema_editor):
    Product = apps.get_model('catalog', 'Product')
    names = [p['name'] for p in PRODUCTS]
    Product.objects.filter(name__in=names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0001_initial'),
        ('studios', '__first__'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
