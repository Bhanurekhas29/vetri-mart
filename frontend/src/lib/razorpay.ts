// Razorpay's payment page opens inside the app in a web view (their phone SDK does not run in Expo Go).
// This file builds the small page that starts it, and describes what the server sends us.
import type { Order } from './types';

export type RazorpayBlock = {
  key_id: string;
  razorpay_order_id: string;
  amount_paise: number;
  currency: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
};

export type PlaceOrderResult = { order: Order; razorpay: RazorpayBlock };

// What the payment page tells the app.
export type PaymentMessage =
  | { type: 'success'; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
  | { type: 'failed'; reason: string }
  | { type: 'dismissed' };

// Test keys (rzp_test_...) only move pretend money, so a real UPI app such as GPay can never complete the payment.
export const isTestMode = (block: RazorpayBlock) => block.key_id.startsWith('rzp_test_');

// In test mode the page offers cards, net banking and wallets only: each ends on Razorpay's mock bank page with Success and
// Failure buttons. UPI is left out: a real UPI app cannot complete a test payment, and Razorpay no longer offers "enter a
// UPI ID" (collect) on Android (tried again on 18 Nov 2026 with success@razorpay: the option did not appear).
// With live keys Razorpay's normal page is used, including UPI.
const TEST_MODE_METHODS = {
  display: {
    blocks: {
      card: { name: 'Pay with a card', instruments: [{ method: 'card' }] },
      netbanking: { name: 'Net banking', instruments: [{ method: 'netbanking' }] },
      wallet: { name: 'Wallets', instruments: [{ method: 'wallet' }] },
    },
    sequence: ['block.card', 'block.netbanking', 'block.wallet'],
    preferences: { show_default_blocks: false },
  },
};

// The public key id is safe to put in a page; the secret key never leaves the server.
export function checkoutPage(block: RazorpayBlock): string {
  const options = {
    ...(isTestMode(block) ? { config: TEST_MODE_METHODS } : {}),
    key: block.key_id,
    amount: block.amount_paise,
    currency: block.currency,
    name: 'Vetri Mart',
    description: block.description,
    order_id: block.razorpay_order_id,
    prefill: block.prefill,
    theme: { color: '#0B1F4B' },
  };
  // "<" is escaped so nothing in the data can end the script early
  const json = JSON.stringify(options).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;background:#F7F8FC;font-family:sans-serif;color:#6B7280;text-align:center;padding-top:40vh}</style></head>
<body>Opening secure payment...
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function send(message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  try {
    var options = ${json};
    options.handler = function (response) {
      send({ type: 'success', razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature });
    };
    options.modal = { ondismiss: function () { send({ type: 'dismissed' }); } };
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response) {
      send({ type: 'failed', reason: (response.error && response.error.description) || 'The payment failed.' });
    });
    rzp.open();
  } catch (e) {
    send({ type: 'failed', reason: 'The payment page could not be opened. Please check your internet connection.' });
  }
</script></body></html>`;
}
