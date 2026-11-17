// The Filter panel: a bottom sheet with price, brand, discount, colour, size and an in-stock switch.
// Nothing changes in the list until Apply. Clear all empties the choices (then Apply to show everything again).
// The choices offered come from the server and only include what exists in the current list.
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { NO_FILTERS } from '@/lib/listing';
import type { ListingFilters, ListingScope } from '@/lib/listing';
import type { FilterOptions } from '@/lib/types';

type Props = { visible: boolean; scope: ListingScope; applied: ListingFilters; onApply: (filters: ListingFilters) => void; onClose: () => void };

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function Chip({ label, active, onPress, a11y }: { label: string; active: boolean; onPress: () => void; a11y?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityLabel={a11y ?? label} accessibilityState={{ checked: active }} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

// The sheet is only mounted while open, so its draft starts as a copy of the filters now applied.
function SheetBody({ scope, applied, onApply, onClose }: Omit<Props, 'visible'>) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ListingFilters>(applied);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['listing-filters', scope],
    queryFn: async () => (await api.get<FilterOptions>('products/filters/', { params: scope })).data,
  });
  const set = (patch: Partial<ListingFilters>) => setDraft((d) => ({ ...d, ...patch }));
  const digits = (text: string) => text.replace(/\D/g, '').slice(0, 7);

  return (
    <View style={[styles.sheet, { paddingBottom: Spacing.sm + insets.bottom }]}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          Filters
        </Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close filters">
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {isLoading && <ActivityIndicator color={Colors.navy} />}
        {isError && <Text style={styles.error}>{getErrorMessage(error)}</Text>}

        <View style={styles.switchRow}>
          <Text style={styles.sectionTitle}>In stock only</Text>
          <Switch value={draft.inStock} onValueChange={(v) => set({ inStock: v })} trackColor={{ true: Colors.navy }} accessibilityLabel="In stock only" />
        </View>

        {data && (
          <>
            <Text style={styles.sectionTitle}>Price</Text>
            <View style={styles.priceRow}>
              <TextInput
                value={draft.minPrice}
                onChangeText={(t) => set({ minPrice: digits(t) })}
                keyboardType="number-pad"
                placeholder={data.price_min ? `Min ${formatRupees(data.price_min)}` : 'Min'}
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                accessibilityLabel="Minimum price"
              />
              <Text style={styles.to}>to</Text>
              <TextInput
                value={draft.maxPrice}
                onChangeText={(t) => set({ maxPrice: digits(t) })}
                keyboardType="number-pad"
                placeholder={data.price_max ? `Max ${formatRupees(data.price_max)}` : 'Max'}
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                accessibilityLabel="Maximum price"
              />
            </View>

            {data.brands.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Brand</Text>
                <View style={styles.chips}>
                  {data.brands.map((b) => (
                    <Chip key={b.slug} label={b.name} active={draft.brands.includes(b.slug)} onPress={() => set({ brands: toggle(draft.brands, b.slug) })} />
                  ))}
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>Discount</Text>
            <View style={styles.chips}>
              <Chip label="Any" active={draft.minDiscount === null} onPress={() => set({ minDiscount: null })} />
              {data.discounts.map((d) => (
                <Chip key={d} label={`${d}% or more`} active={draft.minDiscount === d} onPress={() => set({ minDiscount: draft.minDiscount === d ? null : d })} />
              ))}
            </View>

            {data.colours.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Colour</Text>
                <View style={styles.chips}>
                  {data.colours.map((c) => {
                    const active = draft.colours.includes(c.id);
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => set({ colours: toggle(draft.colours, c.id) })}
                        accessibilityRole="checkbox"
                        accessibilityLabel={c.name}
                        accessibilityState={{ checked: active }}
                        style={[styles.colourChip, active && styles.chipActive]}>
                        <View style={[styles.dot, { backgroundColor: c.hex }]} />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {data.sizes.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Size</Text>
                <View style={styles.chips}>
                  {data.sizes.map((s) => (
                    <Chip key={s.id} label={s.name} active={draft.sizes.includes(s.id)} onPress={() => set({ sizes: toggle(draft.sizes, s.id) })} />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Clear all" variant="secondary" onPress={() => setDraft(NO_FILTERS)} style={styles.footerButton} />
        <Button
          title="Apply"
          onPress={() => {
            onApply(draft);
            onClose();
          }}
          style={styles.footerButton}
        />
      </View>
    </View>
  );
}

export function FilterSheet({ visible, ...rest }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={rest.onClose}>
      <Pressable style={styles.backdrop} onPress={rest.onClose} accessibilityRole="button" accessibilityLabel="Close filters" />
      {visible && <SheetBody {...rest} />}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '85%', backgroundColor: Colors.white, borderTopLeftRadius: Radius.lg + 4, borderTopRightRadius: Radius.lg + 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text },
  close: { fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.navy },
  body: { padding: Spacing.md, paddingBottom: Spacing.lg },
  error: { color: Colors.error, fontSize: FontSize.body },
  sectionTitle: { fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.body + 1, color: Colors.text },
  to: { marginHorizontal: Spacing.sm, color: Colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginRight: Spacing.sm, marginBottom: Spacing.sm },
  chipActive: { borderColor: Colors.navy, backgroundColor: Colors.navySoft },
  chipText: { fontSize: FontSize.body, color: Colors.text },
  chipTextActive: { color: Colors.navy, fontWeight: '700' },
  colourChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginRight: Spacing.sm, marginBottom: Spacing.sm },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: Colors.border, marginRight: 6 },
  footer: { flexDirection: 'row', padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  footerButton: { flex: 1, marginHorizontal: Spacing.xs },
});
