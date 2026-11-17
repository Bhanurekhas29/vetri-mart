// A bottom panel to choose how a list is sorted.
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { SortOption } from '@/lib/types';

type Props = { visible: boolean; options: SortOption[]; value: string; onPick: (value: string) => void; onClose: () => void };

export function SortSheet({ visible, options, value, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close sort options" accessibilityRole="button" />
      <View style={[styles.sheet, { paddingBottom: Spacing.md + insets.bottom }]}>
        <Text style={styles.title} accessibilityRole="header">
          Sort by
        </Text>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                onPick(option.value);
                onClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={styles.row}>
              <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
              {active && <Ionicons name="checkmark" size={20} color={Colors.navy} />}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.lg + 4, borderTopRightRadius: Radius.lg + 4, paddingTop: Spacing.md, paddingHorizontal: Spacing.md },
  title: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  label: { fontSize: FontSize.body + 1, color: Colors.text },
  labelActive: { fontWeight: '700', color: Colors.navy },
});
