// "Deal of the day": a row of product cards and a live countdown to the end of the deal.
// The admin sets the products and the start and end time; the server hides the section when it ends.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProductTile } from '@/components/product-tile';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useCountdown } from '@/lib/countdown';
import { formatCountdown } from '@/lib/format';
import type { Deal } from '@/lib/types';

type Props = {
  title: string;
  deal: Deal;
  receivedAt: number; // when the phone received this data (the countdown runs from then)
  onExpired: () => void; // asks the server for a fresh Home page, which no longer has the deal
};

export function DealSection({ title, deal, receivedAt, onExpired }: Props) {
  const remaining = useCountdown(deal.seconds_left, receivedAt);

  // When the timer reaches zero, ask for fresh data once. This runs only when `expired` flips to true.
  const expired = remaining === 0;
  const latestOnExpired = useRef(onExpired);
  useEffect(() => {
    latestOnExpired.current = onExpired;
  });
  useEffect(() => {
    if (expired) latestOnExpired.current();
  }, [expired]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title || deal.name}
        </Text>
        <View style={styles.timer} accessibilityLabel={`Ends in ${formatCountdown(remaining)}`}>
          <Ionicons name="time-outline" size={14} color={Colors.error} />
          <Text style={styles.timerText}>{formatCountdown(remaining)}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {deal.products.map((product) => (
          <View key={product.id} style={styles.item}>
            <ProductTile product={product} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: Colors.white, marginTop: Spacing.sm, paddingVertical: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text },
  timer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDECEC', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  timerText: { marginLeft: 4, fontSize: FontSize.caption, fontWeight: '700', color: Colors.error, fontVariant: ['tabular-nums'] },
  row: { paddingHorizontal: Spacing.md },
  item: { marginRight: Spacing.sm + 2 },
});
