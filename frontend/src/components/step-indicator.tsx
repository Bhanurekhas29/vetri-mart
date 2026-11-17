// Address -> Payment -> Done: where the shopper is in checkout.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Spacing } from '@/constants/theme';

const STEPS = ['Address', 'Payment', 'Done'];

export function StepIndicator({ current }: { current: 0 | 1 | 2 }) {
  return (
    <View style={styles.row} accessibilityLabel={`Step ${current + 1} of 3: ${STEPS[current]}`}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={styles.item}>
            {i > 0 && <View style={[styles.line, i <= current && styles.lineOn]} />}
            <View style={styles.stepCol}>
              <View style={[styles.dot, (done || active) && styles.dotOn]}>
                {done ? <Ionicons name="checkmark" size={14} color={Colors.white} /> : <Text style={[styles.num, (done || active) && styles.numOn]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.label, active && styles.labelOn]}>{label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', backgroundColor: Colors.white, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  item: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  line: { flex: 1, height: 2, backgroundColor: Colors.border, marginTop: 11 },
  lineOn: { backgroundColor: Colors.navy },
  stepCol: { alignItems: 'center', minWidth: 64 },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: Colors.navy },
  num: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  numOn: { color: Colors.white },
  label: { marginTop: 4, fontSize: FontSize.caption, color: Colors.textMuted },
  labelOn: { color: Colors.navy, fontWeight: '700' },
});
