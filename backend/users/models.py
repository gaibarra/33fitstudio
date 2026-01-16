import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils import timezone
from .managers import UserManager

class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)

    class Meta:
        db_table = 'roles'

    def __str__(self):
        return self.code

class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    studio = models.ForeignKey('studios.Studio', null=True, blank=True, on_delete=models.CASCADE, related_name='users')
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    full_name = models.CharField(max_length=255, null=True, blank=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['studio']),
        ]

    def __str__(self):
        return self.email

    @property
    def roles(self):
        return Role.objects.filter(user_roles__user=self)

    def has_role(self, code: str) -> bool:
        return self.roles.filter(code=code).exists()

    def add_role(self, code: str):
        role, _ = Role.objects.get_or_create(code=code, defaults={'name': code})
        UserRole.objects.get_or_create(user=self, role=role)

class UserRole(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='user_roles')

    class Meta:
        db_table = 'user_roles'
        unique_together = ('user', 'role')

    def __str__(self):
        return f"{self.user.email}-{self.role.code}"
