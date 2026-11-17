// One order: status, tracking timeline, items, delivery address, payment and the price breakdown.
// The shopper can pay an unpaid order again, or cancel while it is Pending payment or Confirmed.
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Picture } from '@/components/picture';
import { StatusBadge } from '@/components/status-badge';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import { formatDate, formatDateTime, formatRupees } from '@/lib/format';
import { useOrder } from '@/lib/orders';
import type { PlaceOrderResult } from '@/lib/razorpay';
import type { Order, OrderStep } from '@/lib/types';

function Timeline({ steps }: { steps: OrderStep[] }) {
  return (
    <View>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const cancelled = step.key === 'cancelled';
        const colour = cancelled ? Colors.error : step.done ? Colors.navy : Colors.border;
        return (
          <View key={step.key} style={styles.stepRow} accessible accessibilityLabel={`${step.label}${step.at ? `, ${formatDateTime(step.at)}` : ', not yet'}${step.detail ? `, ${step.detail}` : ''}`}>
            <View style={styles.stepRail}>
              <View style={[styles.stepDot, { backgroundColor: step.done ? colour : Colors.white, borderColor: colour }]}>
                {step.done && <Ionicons name={cancelled ? 'close' : 'checkmark'} size={13} color={Colors.white} />}
              </View>
              {!last && <View style={[styles.stepLine, step.done && !cancelled && steps[i + 1]?.done && styles.stepLineOn]} />}
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepLabel, !step.done && styles.stepLabelOff, cancelled && styles.stepCancelled]}>{step.label}</Text>
              {step.at ? <Text style={styles.stepTime}>{formatDateTime(step.at)}</Text> : null}
              {step.detail ? <Text style={styles.stepDetail}>{step.detail}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Row({ label, value, good, bold }: { label: string; value: string; good?: boolean; bold?: boolean }) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.priceValue, good && styles.good, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

export default function OrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const { data: order, isLoading, isError, error, refetch } = useOrder(orderId);
  const [busy, setBusy] = useState<'pay' | 'cancel' | 'invoice' | null>(null);

  const header = <Stack.Screen options={{ title: 'Order details' }} />;

  if (isLoading) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }
  if (isError || !order) {
    return (
      <View style={styles.center}>
        {header}
        <Text style={styles.message}>{getErrorMessage(error)}</Text>
        <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.cta} />
      </View>
    );
  }

  async function payNow(o: Order) {
    setBusy('pay');
    try {
      const { data } = await api.post<PlaceOrderResult>(`orders/${o.id}/payment/retry/`);
      router.push({ pathname: '/payment', params: { placed: JSON.stringify(data) } });
    } catch (e) {
      Alert.alert('Could not start the payment', getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  // The invoice opens in the phone's browser or PDF viewer through a private link that works for 5 minutes.
  async function openInvoice(o: Order) {
    setBusy('invoice');
    try {
      const { data } = await api.get<{ url: string }>(`orders/${o.id}/invoice-link/`);
      await Linking.openURL(data.url);
    } catch (e) {
      Alert.alert('Could not open the invoice', getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function confirmCancel(o: Order) {
    Alert.alert(
      'Cancel this order?',
      o.payment.status === 'paid'
        ? 'The items go back on the shelf and we will refund your payment.'
        : 'The items go back on the shelf. You have not been charged.',
      [
        { text: 'Keep order', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: async () => {
            setBusy('cancel');
            try {
              const { data } = await api.post<{ order: Order }>(`orders/${o.id}/cancel/`);
              queryClient.setQueryData(['order', o.id], data.order);
              queryClient.invalidateQueries({ queryKey: ['orders'] });
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
              queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
              queryClient.invalidateQueries({ queryKey: ['product'] });
            } catch (e) {
              Alert.alert('Could not cancel', getErrorMessage(e));
              refetch();
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  const a = order.address;
  const hasActions = order.can_pay || order.can_cancel;

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: hasActions ? 150 + insets.bottom : Spacing.xl }}>
        <View style={styles.card}>
          <View style={styles.headRow}>
            <StatusBadge status={order.status} label={order.status_label} />
            <Text style={styles.total}>{formatRupees(order.price.total)}</Text>
          </View>
          <Text style={styles.number}>{order.order_number}</Text>
          <Text style={styles.meta}>Placed on {formatDate(order.created_at)}</Text>
          {order.refund_pending && <Text style={styles.refund}>Refund pending: we will refund {formatRupees(order.price.total)} to your original payment method.</Text>}
          {order.is_refunded && <Text style={styles.refunded}>Refunded: {formatRupees(order.price.total)} was returned to you.</Text>}
          {order.can_pay && <Text style={styles.warn}>Payment not completed. Pay now to confirm this order.</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Tracking
          </Text>
          <View style={styles.timeline}>
            <Timeline steps={order.timeline} />
          </View>
          {order.delivery_estimate && order.status !== 'delivered' && order.status !== 'cancelled' ? <Text style={styles.estimate}>{order.delivery_estimate}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Items ({order.items.reduce((n, i) => n + i.quantity, 0)})
          </Text>
          {order.items.map((item) => (
            <Pressable
              key={item.sku}
              onPress={() => router.push(`/product/${item.product_slug}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, quantity ${item.quantity}, ${formatRupees(item.line_total)}`}
              style={styles.itemRow}>
              <Picture uri={item.image} alt={item.name} contentFit="contain" icon="cube-outline" style={styles.itemImage} />
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.colour || item.size ? <Text style={styles.meta}>{[item.colour, item.size].filter(Boolean).join(' / ')}</Text> : null}
                <Text style={styles.meta}>
                  {item.quantity} × {formatRupees(item.price)}
                </Text>
              </View>
              <Text style={styles.itemTotal}>{formatRupees(item.line_total)}</Text>
            </Pressable>
          ))}
          {order.items.some((i) => i.can_review) && (
            <View style={styles.reviewBlock}>
              {order.items
                .filter((i) => i.can_review)
                .map((item) => (
                  <Pressable
                    key={`r-${item.sku}`}
                    onPress={() => router.push(`/review/${item.product_slug}`)}
                    accessibilityRole="button"
                    accessibilityLabel={item.review ? `Edit your review of ${item.name}` : `Rate and review ${item.name}`}
                    style={styles.reviewRow}>
                    <Ionicons name={item.review ? 'star' : 'star-outline'} size={18} color={Colors.navy} />
                    <Text style={styles.reviewText} numberOfLines={1}>
                      {item.review ? `Your review: ${item.review.rating} stars. Edit` : `Rate and review ${item.name}`}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </Pressable>
                ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Delivery address
          </Text>
          <Text style={styles.addressName}>{a.recipient_name}</Text>
          <Text style={styles.addressText}>{[a.address_line1, a.address_line2, a.landmark, `${a.city}, ${a.state} ${a.pincode}`].filter(Boolean).join(', ')}</Text>
          <Text style={styles.addressText}>Phone: {a.phone}</Text>
        </View>

        {order.can_invoice && (
          <Pressable
            onPress={() => openInvoice(order)}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel="Open the invoice"
            style={[styles.invoice, busy === 'invoice' && styles.invoiceBusy]}>
            <Ionicons name="document-text-outline" size={20} color={Colors.navy} />
            <Text style={styles.invoiceText}>{busy === 'invoice' ? 'Opening the invoice…' : 'Invoice'}</Text>
            <Ionicons name="open-outline" size={18} color={Colors.textMuted} />
          </Pressable>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Payment
          </Text>
          <Text style={styles.addressText}>
            {order.payment.status === 'paid' || order.payment.status === 'refunded'
              ? `Paid${order.payment.method ? ` with ${order.payment.method}` : ''}`
              : 'Not paid yet'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Price details
          </Text>
          <Row label="Price" value={formatRupees(order.price.mrp_total)} />
          {Number(order.price.product_discount) > 0 && <Row label="Discount" value={`- ${formatRupees(order.price.product_discount)}`} good />}
          {Number(order.price.bundle_discount) > 0 && <Row label="Bundle savings" value={`- ${formatRupees(order.price.bundle_discount)}`} good />}
          {Number(order.price.coupon_discount) > 0 && <Row label={`Coupon ${order.price.coupon_code}`} value={`- ${formatRupees(order.price.coupon_discount)}`} good />}
          <Row label="Delivery" value={Number(order.price.delivery_fee) === 0 ? 'Free' : formatRupees(order.price.delivery_fee)} good={Number(order.price.delivery_fee) === 0} />
          <View style={styles.divider} />
          <Row label={order.payment.status === 'paid' ? 'Total paid' : 'Total'} value={formatRupees(order.price.total)} bold />
        </View>
      </ScrollView>

      {hasActions && (
        <View style={[styles.bar, { paddingBottom: Spacing.sm + insets.bottom }]}>
          {order.can_pay && <Button title={`Pay ${formatRupees(order.price.total)}`} onPress={() => payNow(order)} loading={busy === 'pay'} disabled={busy !== null} />}
          {order.can_cancel && (
            <Button title="Cancel order" variant="danger" onPress={() => confirmCancel(order)} loading={busy === 'cancel'} disabled={busy !== null} style={order.can_pay ? styles.second : undefined} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  message: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center' },
  cta: { marginTop: Spacing.lg, alignSelf: 'stretch' },
  card: { backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  cardTitle: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  number: { marginTop: Spacing.sm, fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  meta: { marginTop: 2, fontSize: FontSize.caption + 1, color: Colors.textMuted },
  refund: { marginTop: Spacing.sm, fontSize: FontSize.body, color: Colors.error, fontWeight: '600', lineHeight: 20 },
  refunded: { marginTop: Spacing.sm, fontSize: FontSize.body, color: Colors.success, fontWeight: '600' },
  warn: { marginTop: Spacing.sm, fontSize: FontSize.body, color: Colors.error, fontWeight: '600' },
  timeline: { paddingTop: Spacing.xs },
  stepRow: { flexDirection: 'row' },
  stepRail: { alignItems: 'center', width: 28 },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepLine: { flex: 1, width: 2, backgroundColor: Colors.border, minHeight: 22 },
  stepLineOn: { backgroundColor: Colors.navy },
  stepBody: { flex: 1, marginLeft: Spacing.sm, paddingBottom: Spacing.md },
  stepLabel: { fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  stepLabelOff: { color: Colors.textMuted, fontWeight: '400' },
  stepCancelled: { color: Colors.error },
  stepTime: { marginTop: 2, fontSize: FontSize.caption + 1, color: Colors.textMuted },
  stepDetail: { marginTop: 2, fontSize: FontSize.body, color: Colors.text },
  estimate: { marginTop: Spacing.xs, fontSize: FontSize.body, color: Colors.success, fontWeight: '600' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  itemImage: { width: 56, height: 56, borderRadius: Radius.md },
  itemBody: { flex: 1, marginHorizontal: Spacing.md },
  itemName: { fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  itemTotal: { fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  addressName: { fontSize: FontSize.body + 1, fontWeight: '700', color: Colors.text },
  addressText: { marginTop: 2, fontSize: FontSize.body, color: Colors.text, lineHeight: 20 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  priceLabel: { fontSize: FontSize.body + 1, color: Colors.text },
  priceValue: { fontSize: FontSize.body + 1, color: Colors.text },
  good: { color: Colors.success, fontWeight: '600' },
  bold: { fontSize: FontSize.title, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.border, marginTop: Spacing.md },
  reviewBlock: { marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  reviewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm + 2 },
  reviewText: { flex: 1, marginHorizontal: Spacing.sm, fontSize: FontSize.body, fontWeight: '600', color: Colors.navy },
  invoice: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  invoiceBusy: { opacity: 0.6 },
  invoiceText: { flex: 1, marginHorizontal: Spacing.sm, fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  second: { marginTop: Spacing.sm },
});
