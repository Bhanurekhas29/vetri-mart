"""The invoice PDF for a paid order. No GST details (none were provided); the seller is the company name from the
Brand settings, with the support email and phone from the Help contact details. Everything on it comes from the order
itself (the copy taken when it was placed), so it never changes if a product or an address is edited later.
"""

import logging
from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from django.core import signing
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from accounts.exceptions import ApiError
from content.models import ContactInfo
from siteconfig.models import BrandSettings

from .models import Order, Payment

logger = logging.getLogger(__name__)

NAVY = colors.HexColor('#0B1F4B')
GREY = colors.HexColor('#6B7280')
LINE = colors.HexColor('#E3E6F0')
SOFT = colors.HexColor('#F7F8FC')

LINK_SALT = 'order-invoice'
LINK_MAX_AGE_SECONDS = 300  # the private link works for 5 minutes

INVOICE_STATUSES = (Order.Status.CONFIRMED, Order.Status.SHIPPED, Order.Status.DELIVERED)


def can_invoice(order):
    return order.status in INVOICE_STATUSES


def make_link_token(order):
    return signing.dumps({'order': order.id, 'user': order.user_id}, salt=LINK_SALT)


def order_from_link_token(token):
    """The order a private invoice link belongs to, or an error if the link is wrong or too old."""
    try:
        data = signing.loads(token, salt=LINK_SALT, max_age=LINK_MAX_AGE_SECONDS)
    except signing.BadSignature:  # also covers an expired link
        raise ApiError('link_expired', 'This invoice link has expired. Please open the invoice again from the app.', 410)
    order = Order.objects.filter(pk=data.get('order'), user_id=data.get('user')).first()
    if order is None or not can_invoice(order):
        raise ApiError('not_found', 'That invoice does not exist.', 404)
    return order


def inr(amount):
    """Rs. 12,34,567.50 (Indian digit grouping). "Rs." is used because standard PDF fonts have no rupee sign."""
    amount = Decimal(amount).quantize(Decimal('0.01'))
    whole, paise = f'{abs(amount):.2f}'.split('.')
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ','.join(groups + [tail])
    return f'{"-" if amount < 0 else ""}Rs. {whole}.{paise}'


def _p(text, style):
    return Paragraph(escape(str(text)).replace('\n', '<br/>'), style)


def invoice_pdf(order):
    brand = BrandSettings.load()
    contact = ContactInfo.load()
    paid = order.payments.filter(status__in=[Payment.Status.PAID, Payment.Status.REFUNDED]).order_by('-created_at').first()
    items = list(order.items.all())

    base = getSampleStyleSheet()['Normal']
    normal = ParagraphStyle('n', parent=base, fontName='Helvetica', fontSize=9.5, leading=13, textColor=colors.black)
    small = ParagraphStyle('s', parent=normal, fontSize=8.5, leading=11, textColor=GREY)
    bold = ParagraphStyle('b', parent=normal, fontName='Helvetica-Bold')
    right = ParagraphStyle('r', parent=normal, alignment=TA_RIGHT)
    right_bold = ParagraphStyle('rb', parent=right, fontName='Helvetica-Bold')
    title = ParagraphStyle('t', parent=normal, fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=NAVY)
    company = ParagraphStyle('c', parent=normal, fontName='Helvetica-Bold', fontSize=15, leading=19, textColor=NAVY)
    heading = ParagraphStyle('h', parent=small, fontName='Helvetica-Bold', textColor=NAVY)

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f'Invoice {order.order_number}', author=brand.company_name)
    story = []

    # ---- header: seller on the left, invoice details on the right ----
    seller = []
    if brand.company_logo:
        try:
            seller.append(Image(brand.company_logo.path, width=16 * mm, height=16 * mm, kind='proportional'))
        except Exception:
            logger.warning('Invoice: the company logo could not be read')
    seller.append(_p(brand.company_name, company))
    contact_line = '   '.join(x for x in (contact.support_email, contact.support_phone) if x)
    if contact_line:
        seller.append(_p(contact_line, small))
    when = timezone.localtime(order.created_at)
    details = [
        _p('INVOICE', ParagraphStyle('ti', parent=title, alignment=TA_RIGHT)),
        _p(f'Invoice no: {order.order_number}', right),
        _p(f'Date: {when:%d %b %Y}', right),
        _p(f'Status: {order.get_status_display()}', right),
    ]
    header = Table([[seller, details]], colWidths=[100 * mm, 74 * mm])
    header.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    story += [header, Spacer(1, 8 * mm)]

    # ---- bill to and payment ----
    address = [order.recipient_name, order.address_line1, order.address_line2, order.landmark, f'{order.city}, {order.state} {order.pincode}', f'Phone: {order.phone}']
    pay_lines = []
    if paid:
        pay_lines.append(f'Paid with: {paid.get_method_display()}' if paid.method else 'Paid online (Razorpay)')
        if paid.razorpay_payment_id:
            pay_lines.append(f'Reference: {paid.razorpay_payment_id}')
        pay_lines.append(f'Paid on: {timezone.localtime(paid.created_at):%d %b %Y}')
    info = Table(
        [[[_p('BILL TO / SHIP TO', heading), _p('\n'.join(x for x in address if x), normal)], [_p('PAYMENT', heading), _p('\n'.join(pay_lines) or 'Payment details not available', normal)]]],
        colWidths=[100 * mm, 74 * mm],
    )
    info.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))
    story += [info, Spacer(1, 7 * mm)]

    # ---- items ----
    rows = [[_p('#', bold), _p('Item', bold), _p('Qty', right_bold), _p('Unit price', right_bold), _p('Amount', right_bold)]]
    for n, item in enumerate(items, start=1):
        version = ' / '.join(x for x in (item.colour, item.size) if x)
        name = item.product_name + (f'\n{version}' if version else '') + f'\nSKU: {item.sku}'
        rows.append([_p(n, normal), _p(name, normal), _p(item.quantity, right), _p(inr(item.price), right), _p(inr(item.price * item.quantity), right)])
    table = Table(rows, colWidths=[9 * mm, 85 * mm, 14 * mm, 33 * mm, 33 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SOFT),
        ('LINEBELOW', (0, 0), (-1, 0), 0.8, NAVY),
        ('LINEBELOW', (0, 1), (-1, -1), 0.4, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story += [table, Spacer(1, 4 * mm)]

    # ---- totals ----
    mrp_total = sum((i.mrp * i.quantity for i in items), Decimal('0'))
    price_total = sum((i.price * i.quantity for i in items), Decimal('0'))
    totals = [[_p('Price (MRP)', right), _p(inr(mrp_total), right)]]
    if mrp_total > price_total:
        totals.append([_p('Discount', right), _p('- ' + inr(mrp_total - price_total), right)])
    if order.bundle_discount:
        totals.append([_p('Bundle savings', right), _p('- ' + inr(order.bundle_discount), right)])
    if order.coupon_discount:
        totals.append([_p(f'Coupon {order.coupon_code}'.strip(), right), _p('- ' + inr(order.coupon_discount), right)])
    totals.append([_p('Delivery', right), _p('Free' if not order.delivery_fee else inr(order.delivery_fee), right)])
    totals.append([_p('Total paid', right_bold), _p(inr(order.total_amount), right_bold)])
    totals_table = Table(totals, colWidths=[40 * mm, 33 * mm], hAlign='RIGHT')
    totals_table.setStyle(TableStyle([
        ('LINEABOVE', (0, -1), (-1, -1), 0.8, NAVY),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story += [totals_table, Spacer(1, 12 * mm)]
    story.append(_p(f'Thank you for shopping with {brand.company_name}. This is a computer generated invoice and needs no signature.', small))

    doc.build(story)
    return buffer.getvalue()
