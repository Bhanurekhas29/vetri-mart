// "Buy these together to save": admin-made bundles that include this product. The saving is calculated by the server.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Picture } from '@/components/picture';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatRupees } from '@/lib/format';
import type { Bundle } from '@/lib/types';

type Props = { bundles: Bundle[]; onAddBundle: (bundle: Bundle) => void };

export function BundlesSection({ bundles, onAddBundle }: Props) {
  if (bundles.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        Buy these together to save
      </Text>
      {bundles.map((bundle) => (
        <View key={bundle.id} style={styles.card}>
          <Text style={styles.name}>{bundle.name}</Text>
          <View style={styles.items}>
            {bundle.items.map((item, i) => (
              <View key={item.variant_id} style={styles.itemWrap}>
                {i > 0 && <Text style={styles.plus}>+</Text>}
                <Pressable
                  onPress={() => router.push(`/product/${item.product_slug}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}${item.quantity > 1 ? `, quantity ${item.quantity}` : ''}, ${formatRupees(item.price)}`}
                  style={styles.item}>
                  <Picture uri={item.image} alt={item.image_alt || item.name} contentFit="contain" icon="cube-outline" style={styles.itemImage} />
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.quantity > 1 ? `${item.quantity} × ` : ''}
                    {item.name}
                  </Text>
                  <Text style={styles.itemPrice}>{formatRupees(item.price)}</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatRupees(bundle.bundle_price)}</Text>
            <Text style={styles.total}>{formatRupees(bundle.total_price)}</Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveText}>
                Save {formatRupees(bundle.saving)} ({bundle.saving_percent}%)
              </Text>
            </View>
          </View>
          <Button title="Add bundle to cart" variant="secondary" onPress={() => onAddBundle(bundle)} style={styles.button} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  heading: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text },
  card: { marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md },
  name: { fontSize: FontSize.body, fontWeight: '600', color: Colors.text },
  items: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  itemWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  plus: { fontSize: FontSize.title, color: Colors.textMuted, marginHorizontal: Spacing.xs },
  item: { flex: 1, alignItems: 'center' },
  itemImage: { width: 72, height: 72, borderRadius: Radius.md },
  itemName: { fontSize: FontSize.caption, color: Colors.text, textAlign: 'center', marginTop: Spacing.xs },
  itemPrice: { fontSize: FontSize.caption, color: Colors.textMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: Spacing.md },
  price: { fontSize: FontSize.heading, fontWeight: '700', color: Colors.text },
  total: { marginLeft: Spacing.sm, fontSize: FontSize.body, color: Colors.textMuted, textDecorationLine: 'line-through' },
  saveBadge: { marginLeft: Spacing.sm, backgroundColor: Colors.success, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  saveText: { color: Colors.white, fontSize: FontSize.caption, fontWeight: '700' },
  button: { marginTop: Spacing.md },
});
