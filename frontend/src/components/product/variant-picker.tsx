// Colour swatches and size chips. Only the options the product really has are shown.
// A choice with no stock is greyed out and struck through, but can still be tapped to see its "Out of stock" message.
import { StyleSheet, Text, View, Pressable } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { ProductColour, ProductSize, ProductVariant } from '@/lib/types';

type Props = {
  colours: ProductColour[];
  sizes: ProductSize[];
  variants: ProductVariant[];
  selected: ProductVariant;
  onSelect: (variant: ProductVariant) => void;
};

export function VariantPicker({ colours, sizes, variants, selected, onSelect }: Props) {
  // A choice is "available" when some in-stock version matches it together with the other chosen option.
  function pick(colourId: number | null, sizeId: number | null) {
    const exact = variants.find((v) => v.colour_id === colourId && v.size_id === sizeId);
    if (exact) return exact;
    // that exact combination does not exist: keep the option just tapped and take the best match
    const sameColour = variants.filter((v) => colourId !== null && v.colour_id === colourId);
    const sameSize = variants.filter((v) => sizeId !== null && v.size_id === sizeId);
    const pool = sameColour.length ? sameColour : sameSize;
    return pool.find((v) => v.in_stock) ?? pool[0];
  }

  const colourOk = (id: number) => variants.some((v) => v.colour_id === id && (selected.size_id === null || v.size_id === selected.size_id) && v.in_stock);
  const sizeOk = (id: number) => variants.some((v) => v.size_id === id && (selected.colour_id === null || v.colour_id === selected.colour_id) && v.in_stock);

  const colourName = colours.find((c) => c.id === selected.colour_id)?.name;

  return (
    <View>
      {colours.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.label}>
            Colour{colourName ? ': ' : ''}
            <Text style={styles.value}>{colourName}</Text>
          </Text>
          <View style={styles.row}>
            {colours.map((c) => {
              const active = c.id === selected.colour_id;
              const ok = colourOk(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    const next = pick(c.id, selected.size_id);
                    if (next) onSelect(next);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}${ok ? '' : ', out of stock'}`}
                  accessibilityState={{ selected: active }}
                  style={[styles.swatchOuter, active && styles.swatchActive, !ok && styles.dim]}>
                  <View style={[styles.swatch, { backgroundColor: c.hex }]} />
                  {!ok && <View style={styles.strike} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {sizes.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.label}>Size</Text>
          <View style={styles.row}>
            {sizes.map((s) => {
              const active = s.id === selected.size_id;
              const ok = sizeOk(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    const next = pick(selected.colour_id, s.id);
                    if (next) onSelect(next);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Size ${s.name}${ok ? '' : ', out of stock'}`}
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive, !ok && styles.dim]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive, !ok && styles.struck]}>{s.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: Spacing.md },
  label: { fontSize: FontSize.body, fontWeight: '600', color: Colors.text },
  value: { fontWeight: '400', color: Colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.sm },
  swatchOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm + 2,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  swatchActive: { borderColor: Colors.navy },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: Colors.border },
  strike: { position: 'absolute', width: 54, height: 2, backgroundColor: Colors.textMuted, transform: [{ rotate: '-45deg' }] },
  chip: {
    minWidth: 48,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  chipActive: { borderColor: Colors.navy, backgroundColor: Colors.navySoft },
  chipText: { fontSize: FontSize.body, color: Colors.text },
  chipTextActive: { color: Colors.navy, fontWeight: '700' },
  struck: { textDecorationLine: 'line-through', color: Colors.textMuted },
  dim: { opacity: 0.5 },
});
