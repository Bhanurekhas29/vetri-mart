from io import BytesIO

from django.core.files.base import ContentFile
from drf_spectacular.utils import extend_schema
from PIL import Image, ImageOps
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from . import services
from .exceptions import ApiError
from .models import Address, OTPCode, User
from .serializers import (
    AddressSerializer, AuthResponseSerializer, DetailSerializer, LogoutSerializer,
    PasswordLoginSerializer, PasswordResetSerializer, PasswordSetSerializer,
    RegisterSerializer, SendOTPSerializer, UserSerializer, VerifyOTPSerializer,
)


class PublicView(APIView):
    """Login-style endpoints ignore any old token the phone may still send."""

    authentication_classes = []
    permission_classes = [AllowAny]


def auth_payload(user, is_new_user=False, request=None):
    return {'is_new_user': is_new_user, **services.tokens_for(user), 'user': UserSerializer(user, context={'request': request}).data}


class SendOTPView(PublicView):
    @extend_schema(request=SendOTPSerializer, responses=DetailSerializer, tags=['Auth'])
    def post(self, request):
        data = SendOTPSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        email = data.validated_data['email']
        purpose = data.validated_data['purpose']

        if purpose == OTPCode.Purpose.RESET_PASSWORD:
            # Same answer whether or not the email has an account, so nobody can probe for accounts.
            if services.find_active_user(email):
                services.send_otp(email, purpose)
            return Response({'detail': 'If that email has an account, we sent a 6-digit code to it.'})

        services.send_otp(email, purpose)
        return Response({'detail': f'We sent a 6-digit code to {email}.'})


class VerifyOTPView(PublicView):
    @extend_schema(request=VerifyOTPSerializer, responses=AuthResponseSerializer, tags=['Auth'])
    def post(self, request):
        data = VerifyOTPSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        email = data.validated_data['email']
        services.check_otp(email, OTPCode.Purpose.LOGIN, data.validated_data['code'])

        user = User.objects.filter(email=email).first()
        if user is None:
            # A new email: no account yet. The app asks for a name, then calls register.
            return Response({'is_new_user': True, 'registration_token': services.make_registration_token(email)})
        if not user.is_active:
            raise ApiError('account_disabled', 'This account has been disabled.', 403)
        return Response(auth_payload(user, request=request))


class RegisterView(PublicView):
    @extend_schema(request=RegisterSerializer, responses=AuthResponseSerializer, tags=['Auth'])
    def post(self, request):
        data = RegisterSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        email = services.read_registration_token(data.validated_data['registration_token'])
        if User.objects.filter(email=email).exists():
            raise ApiError('account_exists', 'An account with this email already exists. Please log in.')
        user = User.objects.create_user(
            email=email,
            password=data.validated_data.get('password') or None,
            name=data.validated_data['name'],
        )
        return Response(auth_payload(user, is_new_user=True, request=request), status=status.HTTP_201_CREATED)


class PasswordLoginView(PublicView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    @extend_schema(request=PasswordLoginSerializer, responses=AuthResponseSerializer, tags=['Auth'])
    def post(self, request):
        data = PasswordLoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = User.objects.filter(email=data.validated_data['email']).first()
        if (
            user is None
            or not user.has_usable_password()
            or not user.check_password(data.validated_data['password'])
        ):
            raise ApiError('invalid_credentials', 'Email or password is incorrect.', 401)
        if not user.is_active:
            raise ApiError('account_disabled', 'This account has been disabled.', 403)
        return Response(auth_payload(user, request=request))


class RefreshView(TokenRefreshView):
    """Swaps a refresh token for a new access token (and a new refresh token)."""

    authentication_classes = []

    @extend_schema(tags=['Auth'])
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class LogoutView(PublicView):
    @extend_schema(request=LogoutSerializer, responses=DetailSerializer, tags=['Auth'])
    def post(self, request):
        data = LogoutSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            RefreshToken(data.validated_data['refresh']).blacklist()
        except TokenError:
            pass  # already expired or revoked: the user is logged out either way
        return Response({'detail': 'Logged out.'})


class LogoutAllView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=DetailSerializer, tags=['Auth'])
    def post(self, request):
        services.revoke_all_tokens(request.user)
        return Response({'detail': 'Logged out from all devices.'})


class PasswordResetView(PublicView):
    @extend_schema(request=PasswordResetSerializer, responses=DetailSerializer, tags=['Auth'])
    def post(self, request):
        data = PasswordResetSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        email = data.validated_data['email']
        services.check_otp(email, OTPCode.Purpose.RESET_PASSWORD, data.validated_data['code'])
        user = services.find_active_user(email)
        if user is None:
            raise ApiError('invalid_otp', "That code isn't right.")
        user.set_password(data.validated_data['new_password'])
        user.save(update_fields=['password'])
        services.revoke_all_tokens(user)  # everyone is logged out after a reset
        return Response({'detail': 'Your password was changed. Please log in.'})


class PasswordSetView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=PasswordSetSerializer, responses=DetailSerializer, tags=['Account'])
    def post(self, request):
        data = PasswordSetSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = request.user
        if user.has_usable_password():
            current = data.validated_data.get('current_password', '')
            if not user.check_password(current):
                raise ApiError('invalid_credentials', 'Your current password is incorrect.')
        user.set_password(data.validated_data['new_password'])
        user.save(update_fields=['password'])
        return Response({'detail': 'Password saved.'})


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):
        return self.request.user

    @extend_schema(tags=['Account'])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(tags=['Account'])
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)


class AddressListCreateView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user, is_deleted=False).order_by('-is_default', '-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        is_first = not Address.objects.filter(user=user, is_deleted=False).exists()
        # The first address is always the default.
        serializer.save(user=user, is_default=serializer.validated_data.get('is_default', False) or is_first)

    @extend_schema(tags=['Account'])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(tags=['Account'])
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user, is_deleted=False)

    def perform_destroy(self, instance):
        # Soft delete: old orders keep a copy of the address, but the book no longer shows it.
        was_default = instance.is_default
        instance.is_deleted = True
        instance.save()
        if was_default:
            newest = self.get_queryset().order_by('-created_at').first()
            if newest:
                newest.is_default = True
                newest.save()

    @extend_schema(tags=['Account'])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(tags=['Account'])
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)

    @extend_schema(tags=['Account'])
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)


class MePhotoView(APIView):
    """Upload (POST, form field `photo`) or remove (DELETE) the profile picture.

    The picture is checked, turned upright, made at most 512 px and saved as a small JPEG on the server; the old one is
    deleted. The answer is the updated profile."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    MAX_BYTES = 5 * 1024 * 1024
    SIZE = 512

    @extend_schema(request={'multipart/form-data': {'type': 'object', 'properties': {'photo': {'type': 'string', 'format': 'binary'}}}}, responses=UserSerializer, tags=['Account'])
    def post(self, request):
        upload = request.FILES.get('photo')
        if upload is None:
            raise ApiError('photo_required', 'Choose a picture to upload.', 400)
        if upload.size > self.MAX_BYTES:
            raise ApiError('photo_too_big', 'That picture is too large. Please choose one under 5 MB.', 400)
        try:
            picture = Image.open(upload)
            picture.verify()
            upload.seek(0)
            picture = ImageOps.exif_transpose(Image.open(upload)).convert('RGB')
        except Exception:
            raise ApiError('invalid_image', 'That file is not a picture we can use. Please choose a photo.', 400)
        picture.thumbnail((self.SIZE, self.SIZE))
        out = BytesIO()
        picture.save(out, 'JPEG', quality=85)

        user = request.user
        old = user.photo.name if user.photo else ''
        user.photo.save(f'user-{user.pk}.jpg', ContentFile(out.getvalue()), save=True)
        if old and old != user.photo.name:
            self._forget(user, old)
        return Response(UserSerializer(user, context={'request': request}).data)

    @staticmethod
    def _forget(user, name):
        """Deletes an old picture file. A file that cannot be deleted right now (for example still being read) is left
        behind rather than failing the upload: the new picture is already saved."""
        try:
            user.photo.storage.delete(name)
        except OSError:
            pass

    @extend_schema(request=None, responses=UserSerializer, tags=['Account'])
    def delete(self, request):
        user = request.user
        if user.photo:
            name = user.photo.name
            user.photo = ''
            user.save(update_fields=['photo'])
            self._forget(user, name)
        return Response(UserSerializer(user, context={'request': request}).data)
