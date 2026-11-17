from rest_framework import serializers

from .models import Address, OTPCode, User
from .validators import validate_app_password


class LowercaseEmailField(serializers.EmailField):
    def to_internal_value(self, data):
        return super().to_internal_value(data).strip().lower()


# ---------- Login ----------

class SendOTPSerializer(serializers.Serializer):
    email = LowercaseEmailField()
    purpose = serializers.ChoiceField(choices=OTPCode.Purpose.choices, default=OTPCode.Purpose.LOGIN)


class VerifyOTPSerializer(serializers.Serializer):
    email = LowercaseEmailField()
    code = serializers.RegexField(r'^\d{6}$', error_messages={'invalid': 'Enter the 6-digit code.'})


class RegisterSerializer(serializers.Serializer):
    registration_token = serializers.CharField()
    name = serializers.CharField(max_length=100, trim_whitespace=True)
    password = serializers.CharField(
        required=False, allow_blank=True, write_only=True, validators=[validate_app_password]
    )


class PasswordLoginSerializer(serializers.Serializer):
    email = LowercaseEmailField()
    password = serializers.CharField(write_only=True)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class PasswordResetSerializer(serializers.Serializer):
    email = LowercaseEmailField()
    code = serializers.RegexField(r'^\d{6}$', error_messages={'invalid': 'Enter the 6-digit code.'})
    new_password = serializers.CharField(write_only=True, validators=[validate_app_password])


class PasswordSetSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=False, allow_blank=True, write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_app_password])


# ---------- Profile ----------

class UserSerializer(serializers.ModelSerializer):
    has_password = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'phone', 'photo_url', 'email_order_updates', 'email_offers', 'has_password']
        read_only_fields = ['id', 'email', 'has_password', 'photo_url']

    def get_has_password(self, user) -> bool:
        return user.has_usable_password()

    def get_photo_url(self, user) -> str:
        """Full web address of the profile picture, or an empty text when there is none."""
        if not user.photo:
            return ''
        request = self.context.get('request')
        return request.build_absolute_uri(user.photo.url) if request else user.photo.url

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Name is required.')
        return value


class AuthResponseSerializer(serializers.Serializer):
    """Shape of a successful login, for the docs page."""

    is_new_user = serializers.BooleanField()
    access = serializers.CharField(required=False)
    refresh = serializers.CharField(required=False)
    user = UserSerializer(required=False)
    registration_token = serializers.CharField(required=False)


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


# ---------- Addresses ----------

class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            'id', 'recipient_name', 'phone', 'pincode', 'address_line1', 'address_line2',
            'landmark', 'city', 'state', 'label', 'is_default',
        ]
        read_only_fields = ['id']
