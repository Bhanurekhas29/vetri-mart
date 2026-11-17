// The Orders tab: the shopper's orders, newest first, with All / Active / Delivered chips.
// Active = still in progress (waiting for payment, confirmed or shipped).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Picture } from '@/components/picture';
import { StatusBadge } from '@/components/status-badge';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/api';
import { formatDate, formatRupees } from '@/lib/format';
import { useOrders } from '@/lib/orders';
import type { OrderFilter } from '@/lib/orders';
import type { OrderCard } from '@/lib/types';

const CHIPS: { value: OrderFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'delivered', label: 'Delivered' },
];

function OrderRow({ order }: { order: OrderCard }) {
  const note = order.refund_pending ? 'Refund pending' : order.is_refunded ? 'Refunded' : order.can_pay ? 'Payment not completed' : '';
  return (
    <Pressable
      onPress={() => router.push(`/order/${order.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.order_number}, ${order.status_label}, ${formatRupees(order.total)}, ${order.first_item}${order.more_items ? ` and ${order.more_items} more` : ''}`}
      style={styles.card}>
      <Picture uri={order.image} alt={order.first_item} contentFit="contain" icon="cube-outline" style={styles.image} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <StatusBadge status={order.status} label={order.status_label} />
          <Text style={styles.total}>{formatRupees(order.total)}</Text>
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {order.first_item}
          {order.more_items > 0 ? <Text style={styles.more}>{`  +${order.more_items} more`}</Text> : null}
        </Text>
        <Text style={styles.meta}>
          {order.order_number} · {formatDate(order.created_at)}
        </Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        {order.can_review ? <Text style={styles.rate}>Rate and review</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

export default function OrdersScreen() {
  const { status } = useAuth();
  const [filter, setFilter] = useState<OrderFilter>('all');
  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useOrders(filter);

  if (status !== 'signedIn') {
    return (
      <View style={styles.center}>
        <Ionicons name="cube-outline" size={56} color={Colors.textMuted} />
        <Text style={styles.title}>Log in to see your orders</Text>
        <Text style={styles.message}>Track your orders and see your past purchases here.</Text>
        <Button title="Log in" onPress={() => router.push('/login')} style={styles.cta} />
      </View>
    );
  }

  const orders = data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {CHIPS.map((chip) => {
          const active = chip.value === filter;
          return (
            <Pressable
              key={chip.value}
              onPress={() => setFilter(chip.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.navy} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.message}>{getErrorMessage(error)}</Text>
          <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.cta} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          renderItem={({ item }) => <OrderRow order={item} />}
          refreshing={false}
          onRefresh={() => refetch()}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          contentContainerStyle={orders.length === 0 ? styles.emptyWrap : styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="cube-outline" size={56} color={Colors.textMuted} />
              <Text style={styles.title}>{filter === 'all' ? 'No orders yet' : filter === 'active' ? 'No active orders' : 'No delivered orders yet'}</Text>
              <Text style={styles.message}>{filter === 'all' ? 'When you place an order, it shows up here.' : 'Orders will appear here as they move along.'}</Text>
              {filter === 'all' && <Button title="Start shopping" onPress={() => router.navigate('/(tabs)')} style={styles.cta} />}
            </View>
          }
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={Colors.navy} style={styles.footer} /> : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  emptyWrap: { flexGrow: 1 },
  list: { paddingBottom: Spacing.xl },
  title: { fontSize: FontSize.heading, fontWeight: '600', color: Colors.text, marginTop: Spacing.md, textAlign: 'center' },
  message: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  cta: { marginTop: Spacing.lg, alignSelf: 'stretch' },
  chips: { flexDirection: 'row', backgroundColor: Colors.white, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  chip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6, marginRight: Spacing.sm },
  chipActive: { borderColor: Colors.navy, backgroundColor: Colors.navy },
  chipText: { fontSize: FontSize.body, color: Colors.text },
  chipTextActive: { color: Colors.white, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  image: { width: 64, height: 64, borderRadius: Radius.md },
  body: { flex: 1, marginHorizontal: Spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontSize: FontSize.body + 1, fontWeight: '700', color: Colors.text },
  name: { marginTop: Spacing.xs, fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  more: { fontSize: FontSize.body, fontWeight: '400', color: Colors.textMuted },
  meta: { marginTop: 2, fontSize: FontSize.caption + 1, color: Colors.textMuted },
  note: { marginTop: 2, fontSize: FontSize.caption + 1, fontWeight: '600', color: Colors.error },
  rate: { marginTop: 4, fontSize: FontSize.body, fontWeight: '700', color: Colors.navy },
  footer: { marginVertical: Spacing.md },
});
