from django.contrib.auth import authenticate, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from studios.models import Studio
from .models import User, Role

class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'phone', 'studio', 'is_active', 'roles', 'created_at']
        read_only_fields = ['id', 'is_active', 'created_at', 'roles']

    def get_roles(self, obj):
        return list(obj.roles.values_list('code', flat=True))

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password_confirmation = serializers.CharField(write_only=True)
    studio_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'phone', 'password', 'password_confirmation', 'studio_id']

    def validate(self, attrs):
        password = attrs.get('password')
        password_confirmation = attrs.pop('password_confirmation', None)
        if password != password_confirmation:
            raise serializers.ValidationError({'password_confirmation': 'Las contraseñas no coinciden'})

        request = self.context.get('request')
        header_studio_id = request.META.get('HTTP_X_STUDIO_ID') if request else None
        payload_studio_id = attrs.get('studio_id')

        if header_studio_id and payload_studio_id and str(payload_studio_id) != str(header_studio_id):
            raise serializers.ValidationError({'studio_id': 'No puedes registrar en otro studio'})

        studio_id = payload_studio_id or header_studio_id
        if not studio_id:
            raise serializers.ValidationError({'studio_id': 'Studio requerido'})

        try:
            attrs['studio'] = Studio.objects.get(id=studio_id)
        except Studio.DoesNotExist:
            raise serializers.ValidationError({'studio_id': 'Studio no encontrado'})

        try:
            password_validation.validate_password(password)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': exc.messages})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data.pop('studio_id', None)
        studio = validated_data.pop('studio')
        user = User.objects.create_user(**validated_data, studio=studio, password=password)
        user.add_role('customer')
        return user

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        user = authenticate(email=email, password=password)
        if not user:
            raise serializers.ValidationError('Credenciales inválidas')
        if not user.is_active:
            raise serializers.ValidationError('Usuario inactivo')
        attrs['user'] = user
        return attrs

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'code', 'name']
        read_only_fields = ['id']
