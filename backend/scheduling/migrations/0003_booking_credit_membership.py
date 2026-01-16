# Generated manually to link bookings with credits or memberships
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('commerce', '0001_initial'),
        ('scheduling', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='credit',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bookings', to='commerce.usercredit'),
        ),
        migrations.AddField(
            model_name='booking',
            name='membership',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bookings', to='commerce.usermembership'),
        ),
    ]
