// What the Home page looks like while it loads: grey blocks where the sections will appear.
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { Colors, Spacing } from '@/constants/theme';

export function HomeSkeleton() {
  return (
    <View accessibilityLabel="Loading" accessibilityLiveRegion="polite">
      <View style={styles.categories}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.category}>
            <Skeleton style={styles.circle} />
            <Skeleton style={styles.categoryLabel} />
          </View>
        ))}
      </View>

      <View style={styles.bannerWrap}>
        <Skeleton style={styles.banner} />
      </View>

      <View style={styles.row}>
        <Skeleton style={styles.rowTitle} />
        <View style={styles.cards}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.card}>
              <Skeleton style={styles.cardImage} />
              <Skeleton style={styles.line} />
              <Skeleton style={[styles.line, styles.short]} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  categories: { flexDirection: 'row', backgroundColor: Colors.white, padding: Spacing.md },
  category: { alignItems: 'center', marginRight: Spacing.md },
  circle: { width: 56, height: 56, borderRadius: 28 },
  categoryLabel: { width: 48, height: 10, marginTop: Spacing.sm },
  bannerWrap: { padding: Spacing.md },
  banner: { width: '100%', aspectRatio: 2, borderRadius: 12 },
  row: { backgroundColor: Colors.white, padding: Spacing.md },
  rowTitle: { width: 160, height: 18, marginBottom: Spacing.md },
  cards: { flexDirection: 'row' },
  card: { width: 130, marginRight: Spacing.sm },
  cardImage: { width: '100%', aspectRatio: 1 },
  line: { height: 12, marginTop: Spacing.sm },
  short: { width: '60%' },
});
