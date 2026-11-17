from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Address, OTPCode, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ('email',)
    list_display = ('email', 'name', 'phone', 'is_staff', 'is_active', 'created_at')
    search_fields = ('email', 'name', 'phone')
    readonly_fields = ('last_login', 'created_at', 'updated_at')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Profile', {'fields': ('name', 'phone', 'photo')}),
        ('Email preferences', {'fields': ('email_order_updates', 'email_offers')}),
        ('Access', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'created_at', 'updated_at')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('email', 'name', 'password1', 'password2')}),
    )


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('recipient_name', 'user', 'city', 'pincode', 'label', 'is_default', 'is_deleted')
    list_filter = ('label', 'is_default', 'is_deleted')
    search_fields = ('recipient_name', 'user__email', 'pincode', 'phone')
    raw_id_fields = ('user',)


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display = ('email', 'purpose', 'attempts', 'expires_at', 'used_at', 'created_at')
    list_filter = ('purpose',)
    search_fields = ('email',)
    readonly_fields = ('email', 'purpose', 'code_hash', 'expires_at', 'attempts', 'used_at', 'created_at')

    def has_add_permission(self, request):
        return False
