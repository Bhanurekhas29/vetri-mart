from datetime import timedelta

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models, transaction
from django.utils import timezone

phone_validator = RegexValidator(
    r'^[6-9]\d{9}$', 'Enter a valid 10-digit Indian mobile number.'
)
pincode_validator = RegexValidator(r'^\d{6}$', 'Enter a valid 6-digit pincode.')


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError('An email address is required.')
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()  # OTP-only account
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault('is_staff', False)
        extra.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self._create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """The verified email is the account identity. Created only after an OTP proves it."""

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=10, blank=True, validators=[phone_validator])
    photo = models.ImageField(upload_to='profiles/', blank=True)
    email_order_updates = models.BooleanField(default=True)
    email_offers = models.BooleanField(default=False)
    # Staff only: when they last pressed "Mark all as read" on the admin bell (older alerts no longer count as new).
    alerts_seen_at = models.DateTimeField(null=True, blank=True, editable=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    def save(self, *args, **kwargs):
        self.email = self.email.lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class Address(models.Model):
    """Saved address book entry. Soft-deleted so old orders keep their history."""

    class Label(models.TextChoices):
        HOME = 'home', 'Home'
        WORK = 'work', 'Work'
        OTHER = 'other', 'Other'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')
    recipient_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=10, validators=[phone_validator])
    pincode = models.CharField(max_length=6, validators=[pincode_validator])
    address_line1 = models.CharField(max_length=200)
    address_line2 = models.CharField(max_length=200, blank=True)
    landmark = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=80)
    state = models.CharField(max_length=80)
    label = models.CharField(max_length=10, choices=Label.choices, default=Label.HOME)
    is_default = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=['user', 'is_deleted'])]
        verbose_name_plural = 'addresses'

    def save(self, *args, **kwargs):
        # MySQL has no conditional unique index, so "one default per user" is enforced here.
        with transaction.atomic():
            if self.is_deleted:
                self.is_default = False
            if self.is_default:
                Address.objects.filter(user=self.user, is_default=True).exclude(
                    pk=self.pk
                ).update(is_default=False)
            super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.recipient_name}, {self.city} {self.pincode}'


class OTPCode(models.Model):
    """One-time code for login or password reset. The code itself is stored hashed."""

    class Purpose(models.TextChoices):
        LOGIN = 'login', 'Login'
        RESET_PASSWORD = 'reset_password', 'Reset password'

    MAX_ATTEMPTS = 5
    VALID_MINUTES = 10

    email = models.EmailField()  # no FK: a new user does not exist yet
    purpose = models.CharField(max_length=20, choices=Purpose.choices)
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['email', 'purpose', 'created_at'])]

    @classmethod
    def issue(cls, email, purpose, code):
        return cls.objects.create(
            email=email.lower(),
            purpose=purpose,
            code_hash=make_password(code),
            expires_at=timezone.now() + timedelta(minutes=cls.VALID_MINUTES),
        )

    def is_usable(self):
        return (
            self.used_at is None
            and self.attempts < self.MAX_ATTEMPTS
            and self.expires_at > timezone.now()
        )

    def verify(self, code):
        """Check a code, counting wrong tries. Marks the OTP used when correct."""
        if not self.is_usable():
            return False
        if check_password(code, self.code_hash):
            self.used_at = timezone.now()
            self.save(update_fields=['used_at'])
            return True
        self.attempts += 1
        self.save(update_fields=['attempts'])
        return False

    def __str__(self):
        return f'{self.email} ({self.purpose})'
