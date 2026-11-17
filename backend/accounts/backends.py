from django.contrib.auth.backends import ModelBackend

from .models import User

ADMIN_EMAIL_DOMAIN = 'vetrimart.local'


class StaffAliasBackend(ModelBackend):
    """Lets staff log in to the admin panel with a short name such as 'admin'.

    'admin' is looked up as admin@vetrimart.local. Customers are not affected: the alias
    works only for staff accounts, and the app's login uses real emails through its own API.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if not username or '@' in username:
            return None  # normal email logins are handled by ModelBackend
        email = f'{username.strip().lower()}@{ADMIN_EMAIL_DOMAIN}'
        try:
            user = User.objects.get(email=email, is_staff=True)
        except User.DoesNotExist:
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
