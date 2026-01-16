import os
from django.core.management.base import BaseCommand
from users.models import Role, User
from studios.models import Studio

class Command(BaseCommand):
    help = 'Crea roles base y un usuario admin inicial si no existe.'

    def handle(self, *args, **options):
        roles = [('admin', 'Administrador'), ('staff', 'Staff'), ('customer', 'Cliente')]
        for code, name in roles:
            Role.objects.get_or_create(code=code, defaults={'name': name})
        self.stdout.write(self.style.SUCCESS('Roles verificados.'))

        admin_email = os.environ.get('INITIAL_ADMIN_EMAIL')
        admin_password = os.environ.get('INITIAL_ADMIN_PASSWORD')
        studio_name = os.environ.get('INITIAL_STUDIO_NAME', '33 F/T Studio')

        if admin_email and admin_password:
            studio, _ = Studio.objects.get_or_create(name=studio_name, defaults={'brand_json': {}})
            user, created = User.objects.get_or_create(email=admin_email, defaults={'studio': studio, 'is_staff': True, 'is_superuser': True})
            if created:
                user.set_password(admin_password)
                user.save()
                user.add_role('admin')
                self.stdout.write(self.style.SUCCESS(f'Usuario admin creado: {admin_email}'))
            else:
                self.stdout.write('Usuario admin ya existe.')
        else:
            self.stdout.write('Variables INITIAL_ADMIN_EMAIL/PASSWORD no definidas; solo roles creados.')
