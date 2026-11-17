"""Lets the web version of the app (a different website, such as a Netlify link) call the API.

A browser refuses to let one website read the answers of another unless the other one allows it (CORS). The phone app
never needs this. Only /api/ is opened up, and only for requests without cookies: the app proves who the shopper is with
the Authorization header (a token), so allowing any website to ask is safe. The admin panel (cookies) is not opened.
"""

ALLOW_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
ALLOW_HEADERS = 'Authorization, Content-Type, Accept'


class ApiCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith('/api/'):
            return self.get_response(request)

        # the browser's "may I?" question before a real request
        if request.method == 'OPTIONS' and 'HTTP_ACCESS_CONTROL_REQUEST_METHOD' in request.META:
            from django.http import HttpResponse

            response = HttpResponse(status=204)
            response['Access-Control-Max-Age'] = '86400'
        else:
            response = self.get_response(request)

        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = ALLOW_METHODS
        response['Access-Control-Allow-Headers'] = ALLOW_HEADERS
        return response
