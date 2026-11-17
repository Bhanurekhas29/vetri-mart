// Checkout, last step: "Order placed". Shown after the payment has been verified by our server.
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { StepIndicator } from '@/components/step-indicator';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatRupees } from '@/lib/format';
import type { Order } from '@/lib/types';

export default function OrderSuccessScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  // the payment page put the confirmed order here
  const order = queryClient.getQueryData<Order>(['order', Number(orderId)]);

  function goHome() {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/(tabs)');
  }
  function viewOrder() {
    // the Orders tab underneath, so Back from the order lands on the list
    if (router.canDismiss()) router.dismissAll();
    router.replace('/(tabs)/orders');
    if (order) router.push(`/order/${order.id}`);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View style={{ paddingTop: insets.top }}>
        <StepIndicator current={2} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.tick} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="checkmark" size={48} color={Colors.white} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Order placed
        </Text>
        <Text style={styles.note}>Thank you! We received your payment.</Text>

        {order && (
          <View style={styles.card}>
            <Row label="Order number" value={order.order_number} />
            <Row label="Amount paid" value={formatRupees(order.price.total)} />
            {order.payment.method ? <Row label="Paid with" value={order.payment.method} /> : null}
            {order.delivery_estimate ? <Row label="Delivery" value={order.delivery_estimate} /> : null}
          </View>
        )}
        <Text style={styles.email}>A confirmation email is on its way.</Text>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Spacing.sm + insets.bottom }]}>
        <Button title="View order" onPress={viewOrder} />
        <Button title="Continue shopping" variant="secondary" onPress={goHome} style={styles.second} />
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  body: { alignItems: 'center', padding: Spacing.lg },
  tick: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text, marginTop: Spacing.md },
  note: { fontSize: FontSize.body + 1, color: Colors.textMuted, marginTop: Spacing.xs },
  card: { alignSelf: 'stretch', backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginTop: Spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs + 2 },
  rowLabel: { fontSize: FontSize.body + 1, color: Colors.textMuted },
  rowValue: { fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text, flexShrink: 1, textAlign: 'right', marginLeft: Spacing.md },
  email: { marginTop: Spacing.md, fontSize: FontSize.body, color: Colors.textMuted },
  bar: { backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  second: { marginTop: Spacing.sm },
});
