// The coloured pill that names an order's status. White text on a solid colour (orange is for badges, not for text).
import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius } from '@/constants/theme';
import type { OrderStatus } from '@/lib/types';

const COLOURS: Record<OrderStatus, string> = {
  pending_payment: Colors.orange,
  confirmed: Colors.navy,
  shipped: '#1565C0',
  delivered: Colors.success,
  cancelled: Colors.error,
};

export function StatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: COLOURS[status] }]} accessibilityLabel={`Status: ${label}`}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  text: { color: Colors.white, fontSize: FontSize.caption, fontWeight: '700' },
});
