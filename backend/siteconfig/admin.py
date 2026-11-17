from django import forms
from django.contrib import admin, messages
from django.core.mail import EmailMessage
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.html import format_html

from .constants import brevo_enabled
from .email_backend import get_email_connection
from .models import AnnouncementSettings, BrandSettings, EmailSettings, PaymentSettings, SEOSettings


class SingletonAdmin(admin.ModelAdmin):
    """These screens have one record. The menu link opens it directly, with no list in between."""

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        obj = self.model.load()
        opts = self.model._meta
        return redirect(reverse(f'admin:{opts.app_label}_{opts.model_name}_change', args=[obj.pk]))


class SecretModelForm(forms.ModelForm):
    """Secrets are shown as dots, never printed back. Leave blank to keep the saved one."""

    secret_fields = ()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name in self.secret_fields:
            field = self.fields[name]
            field.required = False
            field.widget = forms.PasswordInput(render_value=False, attrs={'autocomplete': 'new-password'})
            saved = bool(getattr(self.instance, name, ''))
            status = 'A value is saved. Leave this empty to keep it, or type a new one to replace it.' if saved else 'Nothing saved yet.'
            field.help_text = f'{status} {field.help_text}'.strip()

    def clean(self):
        data = super().clean()
        for name in self.secret_fields:
            if not data.get(name):
                data[name] = getattr(self.instance, name, '')
        return data


# ---------- SEO ----------

@admin.register(SEOSettings)
class SEOSettingsAdmin(SingletonAdmin):
    fieldsets = (
        ('Search results', {'fields': ('meta_title', 'meta_description')}),
        ('Keywords', {'fields': ('primary_keywords', 'secondary_keywords')}),
    )


# ---------- Announcement ticker ----------

@admin.register(AnnouncementSettings)
class AnnouncementSettingsAdmin(SingletonAdmin):
    fields = ('is_enabled', 'speed')


# ---------- Email ----------

class EmailSettingsForm(SecretModelForm):
    secret_fields = ('app_password',)
    send_test_to = forms.EmailField(
        required=False,
        label='Send a test email to',
        help_text='Optional. Type an address and press Save: a test email is sent using the details above.',
    )

    class Meta:
        model = EmailSettings
        fields = '__all__'

    def clean(self):
        data = super().clean()
        if data.get('is_enabled'):
            required = {'from_email': 'sender email'}
            if not brevo_enabled():  # with Brevo the key comes from the server settings, not from here
                required = {
                    'smtp_host': 'SMTP host',
                    'smtp_username': 'SMTP username',
                    'app_password': 'app password',
                    'from_email': 'sender email',
                }
            for name, label in required.items():
                if not data.get(name):
                    self.add_error(name, f'Enter the {label} before switching on real emails.')
        return data


@admin.register(EmailSettings)
class EmailSettingsAdmin(SingletonAdmin):
    form = EmailSettingsForm
    fieldsets = (
        ('Switch', {'fields': ('is_enabled',)}),
        ('SMTP server', {'fields': ('smtp_host', 'smtp_port', 'security')}),
        ('Login', {'fields': ('smtp_username', 'app_password')}),
        ('Sender', {'fields': ('from_name', 'from_email')}),
        ('Test', {'fields': ('send_test_to',)}),
    )

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        recipient = form.cleaned_data.get('send_test_to')
        if not recipient:
            return
        if brevo_enabled():
            if not obj.from_email:
                messages.error(request, 'Fill in the sender email to send a test email.')
                return
        elif not (obj.smtp_host and obj.smtp_username and obj.app_password and obj.from_email):
            messages.error(request, 'Fill in the SMTP host, username, app password and sender email to send a test email.')
            return
        try:
            EmailMessage(
                subject='Vetri Mart test email',
                body='This is a test email from your Vetri Mart admin panel. Your email settings work.',
                from_email=obj.formatted_from(),
                to=[recipient],
                connection=get_email_connection(obj),
            ).send()
            messages.success(request, f'Test email sent to {recipient}. Check the inbox and the spam folder.')
        except Exception as exc:  # shown to the admin so they can fix the settings
            messages.error(request, f'The test email could not be sent: {exc}')


# ---------- Payment ----------

class PaymentSettingsForm(SecretModelForm):
    secret_fields = ('razorpay_key_secret',)

    class Meta:
        model = PaymentSettings
        fields = '__all__'


@admin.register(PaymentSettings)
class PaymentSettingsAdmin(SingletonAdmin):
    form = PaymentSettingsForm
    fieldsets = (('Razorpay', {'fields': ('razorpay_key_id', 'razorpay_key_secret')}),)


# ---------- Brand ----------

@admin.register(BrandSettings)
class BrandSettingsAdmin(SingletonAdmin):
    readonly_fields = ('logo_preview',)
    fieldsets = (
        ('Company', {'fields': ('company_name',)}),
        ('Logo', {'fields': ('company_logo', 'logo_preview', 'logo_alt')}),
        ('Credits', {'fields': ('credits_text', 'credits_url')}),
    )

    @admin.display(description='Current logo')
    def logo_preview(self, obj):
        if not obj.company_logo:
            return '-'
        return format_html('<img src="{}" style="max-height:80px;max-width:240px;" alt="">', obj.company_logo.url)
