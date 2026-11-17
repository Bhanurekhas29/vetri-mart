// A row of five stars for a rating such as 4.5 (half stars are shown).
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[1, 2, 3, 4, 5].map((n) => {
        const name = rating >= n - 0.25 ? 'star' : rating >= n - 0.75 ? 'star-half' : 'star-outline';
        return <Ionicons key={n} name={name} size={size} color={Colors.success} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row' } });
