"""Site-wide settings. Each of these has exactly one row, edited from the admin panel."""

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from .constants import BRAND_CACHE_KEY, brevo_enabled
from .fields import EncryptedTextField


class MediaFile(models.Model):
    """A picture kept in the database. Used only on a host whose disk is wiped on restart (MEDIA_IN_DATABASE=True)."""

    name = models.CharField(max_length=255, unique=True)  # the path, for example products/pen.jpg
    content = models.BinaryField()
    content_type = models.CharField(max_length=100, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class SingletonModel(models.Model):
    """A table that only ever holds one row (pk=1)."""

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass  # the one row is never deleted

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class SEOSettings(SingletonModel):
    meta_title = models.CharField(max_length=70, blank=True, help_text='Shown as the page title in search results. About 60 characters works best.')
    meta_description = models.CharField(max_length=160, blank=True, help_text='The short summary under the title in search results. Up to 160 characters.')
    primary_keywords = models.TextField(blank=True, help_text='The main search words, separated by commas. For example: online shopping, vetri mart')
    secondary_keywords = models.TextField(blank=True, help_text='Supporting search words, separated by commas.')

    class Meta:
        verbose_name = 'SEO settings'
        verbose_name_plural = 'SEO settings'

    def __str__(self):
        return 'SEO settings'


class AnnouncementSettings(SingletonModel):
    """How the moving announcement line on Home behaves. The messages themselves are in Content > Announcements."""

    class Speed(models.TextChoices):
        SLOW = 'slow', 'Slow'
        NORMAL = 'normal', 'Normal'
        FAST = 'fast', 'Fast'

    is_enabled = models.BooleanField('show the moving line', default=True, help_text='Untick to hide the line on Home, even when messages are live.')
    speed = models.CharField(max_length=6, choices=Speed.choices, default=Speed.NORMAL, help_text='How fast the text moves. One speed for the whole line.')

    class Meta:
        verbose_name = 'Announcement ticker settings'
        verbose_name_plural = 'Announcement ticker settings'

    def __str__(self):
        return 'Announcement ticker settings'


class EmailSettings(SingletonModel):
    """SMTP details used to send OTP and order emails. Until it is switched on, emails print in the server terminal."""

    class Security(models.TextChoices):
        TLS = 'tls', 'TLS (STARTTLS), usually port 587'
        SSL = 'ssl', 'SSL, usually port 465'
        NONE = 'none', 'None (not recommended)'

    is_enabled = models.BooleanField('send real emails', default=False, help_text='Off: emails are only printed in the server terminal.')
    smtp_host = models.CharField('SMTP host', max_length=150, blank=True, help_text='For Gmail: smtp.gmail.com')
    smtp_port = models.PositiveIntegerField('SMTP port', default=587, validators=[MinValueValidator(1), MaxValueValidator(65535)])
    security = models.CharField(max_length=4, choices=Security.choices, default=Security.TLS)
    smtp_username = models.CharField('SMTP username', max_length=150, blank=True, help_text='Usually the full email address.')
    app_password = EncryptedTextField('app password', blank=True, help_text='For Gmail, create an App Password in your Google account. It is saved encrypted.')
    from_name = models.CharField('sender name', max_length=100, blank=True, help_text='The name customers see, for example: Vetri Mart')
    from_email = models.EmailField('sender email', blank=True)

    class Meta:
        verbose_name = 'Email settings'
        verbose_name_plural = 'Email settings'

    def is_ready(self):
        if brevo_enabled():  # the SMTP details are not needed: the API key comes from the server settings
            return bool(self.is_enabled and self.from_email)
        return bool(self.is_enabled and self.smtp_host and self.smtp_username and self.app_password and self.from_email)

    def formatted_from(self):
        return f'{self.from_name} <{self.from_email}>' if self.from_name else self.from_email

    def __str__(self):
        return 'Email settings'


class PaymentSettings(SingletonModel):
    razorpay_key_id = models.CharField('Razorpay key ID', max_length=60, blank=True, help_text='Starts with rzp_test_ (test mode) or rzp_live_ (live mode).')
    razorpay_key_secret = EncryptedTextField('Razorpay key secret', blank=True, help_text='Saved encrypted. Never share it.')

    class Meta:
        verbose_name = 'Payment settings'
        verbose_name_plural = 'Payment settings'

    @property
    def is_test_mode(self):
        return self.razorpay_key_id.startswith('rzp_test_')

    def is_configured(self):
        return bool(self.razorpay_key_id and self.razorpay_key_secret)

    def __str__(self):
        return 'Payment settings'


class BrandSettings(SingletonModel):
    company_name = models.CharField(max_length=100, default='Vetri Mart')
    company_logo = models.ImageField(upload_to='brand/', blank=True)
    logo_alt = models.CharField('logo alt text', max_length=150, blank=True, help_text='Describe the logo. Required when a logo is added.')
    credits_text = models.CharField(
        'credits info', max_length=150, blank=True, default='Designed and developed by vetriitsystems.com',
        help_text='Shown in the admin footer.',
    )
    credits_url = models.URLField('credits link', blank=True, default='https://vetriitsystems.com', help_text='Optional. Makes the credits text a link.')

    class Meta:
        verbose_name = 'Brand'
        verbose_name_plural = 'Brand'

    def clean(self):
        if self.company_logo and not self.logo_alt.strip():
            raise ValidationError({'logo_alt': 'Describe the logo (alt text). It is required when a logo is added.'})

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        cache.delete(BRAND_CACHE_KEY)  # the admin header reads this, so refresh it

    def __str__(self):
        return self.company_name
