"""One look for every Vetri Mart email: a navy header, the message, an optional table of lines, a grey footer.

The login-code email (accounts/services.py) uses the same colours. Every email is sent with a plain-text version as well.
"""

from html import escape


def branded_email(heading, paragraphs, table=None, total=None, note=None):
    """Returns the HTML of an email.

    heading:    the big line at the top of the card.
    paragraphs: a list of plain-text paragraphs (they are escaped here).
    table:      optional list of (left, right) text pairs, for example items and their prices.
    total:      optional (label, value) shown in bold under the table.
    note:       optional small grey text under everything.
    """
    body = ''.join(f'<p style="margin:0 0 12px;font-size:14px;line-height:21px;color:#1B1F2A;">{escape(p)}</p>' for p in paragraphs if p)

    rows = ''
    if table:
        cells = ''.join(
            f'<tr><td style="padding:8px 0;border-bottom:1px solid #E3E6F0;font-size:14px;color:#1B1F2A;">{escape(left)}</td>'
            f'<td align="right" style="padding:8px 0 8px 12px;border-bottom:1px solid #E3E6F0;font-size:14px;color:#1B1F2A;white-space:nowrap;">{escape(right)}</td></tr>'
            for left, right in table
        )
        if total:
            cells += (
                f'<tr><td style="padding:12px 0 0;font-size:15px;font-weight:bold;color:#0B1F4B;">{escape(total[0])}</td>'
                f'<td align="right" style="padding:12px 0 0 12px;font-size:15px;font-weight:bold;color:#0B1F4B;white-space:nowrap;">{escape(total[1])}</td></tr>'
            )
        rows = f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px;">{cells}</table>'

    small = f'<p style="margin:12px 0 0;font-size:13px;line-height:19px;color:#6B7280;">{escape(note)}</p>' if note else ''

    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F7F8FC;font-family:Arial,Helvetica,sans-serif;color:#1B1F2A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FC;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E3E6F0;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0B1F4B;padding:18px 24px;font-size:20px;font-weight:bold;color:#FFFFFF;">Vetri<span style="color:#F57C00;">Mart</span></td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 14px;font-size:18px;font-weight:bold;color:#0B1F4B;">{escape(heading)}</p>
          {body}{rows}{small}
        </td></tr>
        <tr><td style="padding:12px 24px;border-top:1px solid #E3E6F0;font-size:12px;color:#9CA3AF;">Vetri Mart &middot; You get order emails because "email me about my orders" is on in Settings.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
