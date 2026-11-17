// "Complete the combo and save": bundles the cart has started but not finished. One tap adds the missing items.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Picture } from '@/components/picture';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import type { BundleSuggestion } from '@/lib/types';

type Props = { suggestions: BundleSuggestion[]; addItems: (items: { variantId: number; quantity: number }[]) => Promise<void> };

export function BundleSuggestions({ suggestions, addItems }: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  if (suggestions.length === 0) return null;

  async function add(s: BundleSuggestion) {
    if (busy !== null) return;
    setBusy(s.bundle_id);
    try {
      await addItems(s.missing.map((m) => ({ variantId: m.variant_id, quantity: m.quantity })));
    } catch (e) {
      Alert.alert('Cart', getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.wrap}>
      {suggestions.map((s) => (
        <View key={s.bundle_id} style={styles.card}>
          <View style={styles.head}>
            <Ionicons name="gift-outline" size={20} color={Colors.success} />
            <Text style={styles.title} accessibilityRole="header">
              Complete the {s.name} and save {formatRupees(s.saving)}
            </Text>
          </View>
          {s.missing.map((m) => (
            <View key={m.variant_id} style={styles.item}>
              <Picture uri={m.image} alt={m.image_alt} contentFit="contain" icon="cube-outline" style={styles.image} />
              <View style={styles.itemBody}>
                <Text style={styles.name} numberOfLines={2}>
                  {m.quantity > 1 ? `${m.quantity} × ` : ''}
                  {m.name}
                </Text>
                {m.label ? <Text style={styles.label}>{m.label}</Text> : null}
                <Text style={styles.price}>{formatRupees(m.price)}</Text>
              </View>
            </View>
          ))}
          <Pressable
            onPress={() => add(s)}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel={`Add the missing items to complete the ${s.name} and save ${formatRupees(s.saving)}`}
            style={[styles.button, busy !== null && styles.buttonBusy]}>
            <Text style={styles.buttonText}>{busy === s.bundle_id ? 'Adding…' : 'Add and save'}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.sm },
  card: { backgroundColor: Colors.white, borderLeftWidth: 4, borderLeftColor: Colors.success, padding: Spacing.md, marginBottom: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, marginLeft: Spacing.sm, fontSize: FontSize.body + 1, fontWeight: '700', color: Colors.text },
  item: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },
  image: { width: 52, height: 52, borderRadius: Radius.md },
  itemBody: { flex: 1, marginLeft: Spacing.md },
  name: { fontSize: FontSize.body, fontWeight: '600', color: Colors.text },
  label: { fontSize: FontSize.caption + 1, color: Colors.textMuted },
  price: { marginTop: 2, fontSize: FontSize.body, color: Colors.text },
  button: { marginTop: Spacing.md, borderWidth: 1.5, borderColor: Colors.navy, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
  buttonBusy: { opacity: 0.5 },
  buttonText: { fontSize: FontSize.body + 1, fontWeight: '700', color: Colors.navy },
});
