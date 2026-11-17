"""Adds sample FAQs and the Terms, Privacy and About pages, so the Help screen and the About pages are not empty.

The wording is sample text for the demo: replace it with your client's real text in the admin (Content > FAQs and
Content > Static pages). Safe to run again: it only adds what is missing and never overwrites edited text.
Page text: a blank line starts a new paragraph, and a line beginning with "# " is a heading.
"""

from django.core.management.base import BaseCommand

from content.models import FAQ, StaticPage

FAQS = [
    ('How do I track my order?', 'Open the Orders tab and tap your order. The tracking steps show when it was placed, confirmed, shipped (with the courier name and tracking number) and delivered. We also send a notification at each step.'),
    ('When will my order arrive?', 'The delivery time for your area shows on the product page and at checkout once you enter your pincode. It usually takes a few working days after the order is confirmed.'),
    ('What are the delivery charges?', 'A small flat delivery fee applies to smaller orders. Delivery is free once your order reaches the free-delivery amount, which is shown in your cart.'),
    ('How can I pay?', 'You can pay by UPI, debit or credit card, net banking or wallet. Payments are handled securely by Razorpay, and we never see or store your card details. Cash on delivery is not available yet.'),
    ('My payment failed. Was I charged?', 'If the payment fails, no money is taken. If your bank did debit you, it is returned to your account by your bank, normally within a few working days. You can try again from Orders: open the order and tap Pay.'),
    ('Can I cancel my order?', 'Yes, until it is shipped. Open the order in the Orders tab and tap Cancel order. If you already paid, we refund the amount to your original payment method. Once an order has shipped, please contact us.'),
    ('How will I get my refund?', 'Refunds go back to the payment method you used, and can take a few working days to show in your account. You will get a notification and an email when we have refunded you.'),
    ('Can I return an item?', 'Returns are not available in the app yet. If something is wrong with your order, please contact us with your order number and we will help.'),
    ('How do I get an invoice?', 'Open your order in the Orders tab and tap Invoice. It opens as a PDF that you can save or share.'),
]

PAGES = {
    'terms': ('Terms and conditions', """# Using Vetri Mart

By using this app and placing an order you agree to these terms.

# Orders and prices

Prices are shown in Indian rupees and include all taxes. An order is confirmed when your payment is successful. We may cancel an order if an item is out of stock or cannot be delivered to your address, and we will refund any payment you made.

# Delivery

Delivery times shown in the app are estimates. Please make sure your address and phone number are correct, as the courier uses them to reach you.

# Cancellations and refunds

You can cancel an order before it ships from the Orders tab. Paid orders that are cancelled are refunded to the original payment method.

# Your account

Keep your login details safe. You are responsible for activity on your account.

# Contact

Questions about these terms? Use the contact details on the Help screen."""),
    'privacy': ('Privacy policy', """# What we collect

When you create an account we collect your name, email and, if you give them, your phone number and delivery addresses. When you order, we keep the order details so we can deliver it and show it in your history.

# How we use it

We use your details to run your account, deliver your orders, send order updates and answer your questions. We send offers only if you have turned them on in Settings.

# Payments

Payments are made on Razorpay's secure page. We never see or store your card, UPI or bank details.

# Sharing

We share only what is needed to deliver and pay for your order, such as your name, address and phone number with the courier. We do not sell your personal information.

# Your choices

You can change your details, email preferences and addresses in the app at any time, and you can log out of all devices from Settings.

# Contact

For any privacy question, use the contact details on the Help screen."""),
    'about': ('About Vetri Mart', """# Vetri Mart

Vetri Mart is your neighbourhood online store for electronics and stationery: earphones, neckbands, earbuds, pens and more, from brands you know, delivered to your door.

# Why shop with us

Clear prices with the discount shown, delivery times for your pincode, secure payments, and easy tracking of every order.

# Need help?

Visit the Help screen for answers to common questions or to reach us."""),
}


class Command(BaseCommand):
    help = 'Add sample FAQs and the Terms, Privacy and About pages.'

    def handle(self, *args, **options):
        added_faqs = added_pages = 0
        for order, (question, answer) in enumerate(FAQS, start=1):
            _, created = FAQ.objects.get_or_create(question=question, defaults={'answer': answer, 'sort_order': order})
            added_faqs += created
        for slug, (title, body) in PAGES.items():
            _, created = StaticPage.objects.get_or_create(slug=slug, defaults={'title': title, 'body': body})
            added_pages += created
        self.stdout.write(self.style.SUCCESS(f'Added {added_faqs} FAQs and {added_pages} pages.'))
