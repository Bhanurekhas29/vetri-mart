// The payment page: Razorpay's own payment screen, opened inside the app.
// The shopper pays there (card details never touch our app or server). When it reports a payment, we send it to our
// server, which checks Razorpay's signature; only then is the order confirmed. If anything goes wrong the order stays
// "Pending payment" and the shopper can try again.
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

import { Button } from '@/components/button';
import { StepIndicator } from '@/components/step-indicator';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import { checkoutPage, isTestMode } from '@/lib/razorpay';
import type { PaymentMessage, PlaceOrderResult, RazorpayBlock } from '@/lib/razorpay';
import type { Order } from '@/lib/types';

type Phase = 'paying' | 'verifying' | 'failed' | 'cancelled' | 'problem';

export default function PaymentScreen() {
  const queryClient = useQueryClient();
  const { placed } = useLocalSearchParams<{ placed: string }>();
  const first = JSON.parse(placed) as PlaceOrderResult;
  const order = first.order;

  const [block, setBlock] = useState<RazorpayBlock>(first.razorpay);
  const [attempt, setAttempt] = useState(0); // a new number reloads the payment page
  const [phase, setPhase] = useState<Phase>('paying');
  const [message, setMessage] = useState('');
  const handled = useRef(false); // the payment page can report twice; only the first counts

  async function onMessage(event: WebViewMessageEvent) {
    let msg: PaymentMessage;
    try {
      msg = JSON.parse(event.nativeEvent.data) as PaymentMessage;
    } catch {
      return;
    }
    if (handled.current) return;

    if (msg.type === 'dismissed') {
      setPhase('cancelled');
      return;
    }
    if (msg.type === 'failed') {
      handled.current = true;
      setMessage(msg.reason);
      setPhase('failed');
      api.post(`orders/${order.id}/payment/failed/`, { razorpay_order_id: block.razorpay_order_id, reason: msg.reason }).catch(() => undefined);
      return;
    }

    // success: ask our server to check it
    handled.current = true;
    setPhase('verifying');
    try {
      const { data } = await api.post<{ order: Order }>(`orders/${order.id}/payment/verify/`, {
        razorpay_order_id: msg.razorpay_order_id,
        razorpay_payment_id: msg.razorpay_payment_id,
        razorpay_signature: msg.razorpay_signature,
      });
      queryClient.setQueryData(['order', data.order.id], data.order);
      // stock, the cart, notifications and orders have all changed
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['checkout'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      router.replace({ pathname: '/order-success', params: { orderId: String(data.order.id) } });
    } catch (e) {
      // sold out, cancelled, or no internet: the money may have been taken, so say so and send them to Orders to check
      setMessage(getErrorMessage(e));
      setPhase('problem');
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  }

  async function tryAgain() {
    handled.current = false;
    try {
      const { data } = await api.post<PlaceOrderResult>(`orders/${order.id}/payment/retry/`);
      setBlock(data.razorpay);
      setAttempt((n) => n + 1);
      setPhase('paying');
    } catch (e) {
      setMessage(getErrorMessage(e));
      setPhase('problem');
    }
  }

  const backToCart = () => router.navigate('/cart');
  function viewOrders() {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/(tabs)/orders');
  }

  if (phase === 'paying' || phase === 'verifying') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Payment', gestureEnabled: false }} />
        <StepIndicator current={1} />
        <View style={styles.web}>
          <WebView
            key={attempt}
            originWhitelist={['*']}
            source={{ html: checkoutPage(block), baseUrl: 'https://checkout.razorpay.com' }}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            onMessage={onMessage}
            // UPI and bank apps open through links that are not web pages (upi://...): hand those to the phone (live keys only)
            onShouldStartLoadWithRequest={(request) => {
              if (/^(https?:|about:|data:|blob:)/i.test(request.url)) return true;
              // test keys: never open a real UPI app, it cannot complete a test payment
              if (!isTestMode(block)) Linking.openURL(request.url).catch(() => undefined);
              return false;
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={Colors.navy} />
              </View>
            )}
          />
          {phase === 'verifying' && (
            <View style={styles.verifying} accessibilityLiveRegion="polite">
              <ActivityIndicator color={Colors.navy} size="large" />
              <Text style={styles.verifyText}>Confirming your payment…</Text>
              <Text style={styles.verifyNote}>Please do not close the app.</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  const failed = phase === 'failed';
  const cancelled = phase === 'cancelled';
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Payment', gestureEnabled: false }} />
      <StepIndicator current={1} />
      <View style={styles.center}>
        <Ionicons name={cancelled ? 'time-outline' : 'close-circle'} size={64} color={cancelled ? Colors.textMuted : Colors.error} />
        <Text style={styles.title}>{cancelled ? 'Payment not completed' : failed ? 'Payment failed' : 'We could not confirm your payment'}</Text>
        <Text style={styles.note}>
          {cancelled
            ? 'You closed the payment page. Your order is saved, and you can try again.'
            : failed
              ? message || 'The payment did not go through. No money was taken.'
              : `${message} If money was taken from your account it will be returned. You can check Orders for the latest.`}
        </Text>
        {(cancelled || failed) && <Button title="Try payment again" onPress={tryAgain} style={styles.cta} />}
        {!cancelled && !failed && <Button title="Go to my orders" onPress={viewOrders} style={styles.cta} />}
        <Button title="Back to cart" variant={cancelled || failed ? 'secondary' : 'link'} onPress={backToCart} style={styles.cta2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  web: { flex: 1 },
  loading: { ...StyleSheet.absoluteFill as object, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  verifying: { ...StyleSheet.absoluteFill as object, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(247,248,252,0.96)' },
  verifyText: { marginTop: Spacing.md, fontSize: FontSize.title, fontWeight: '600', color: Colors.text },
  verifyNote: { marginTop: Spacing.xs, fontSize: FontSize.body, color: Colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  title: { fontSize: FontSize.heading, fontWeight: '600', color: Colors.text, marginTop: Spacing.md, textAlign: 'center' },
  note: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 21 },
  cta: { marginTop: Spacing.lg, alignSelf: 'stretch' },
  cta2: { marginTop: Spacing.sm, alignSelf: 'stretch' },
});
