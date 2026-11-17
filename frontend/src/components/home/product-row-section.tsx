// A titled row of product cards, such as "Recommended deals". The admin picks the products and the row size.
// "See all" appears only when the collection holds more products than this row shows.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProductTile } from '@/components/product-tile';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import type { ProductCard } from '@/lib/types';

type Props = {
  title: string;
  collection: { slug: string; name: string };
  products: ProductCard[];
  hasMore: boolean;
};

export function ProductRowSection({ title, collection, products, hasMore }: Props) {
  const heading = title || collection.name;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {heading}
        </Text>
        {hasMore && (
          <Pressable
            onPress={() => router.push(`/collection/${collection.slug}`)}
            accessibilityRole="button"
            accessibilityLabel={`See all ${heading}`}
            hitSlop={8}
            style={styles.seeAll}>
            <Text style={styles.seeAllText}>See all</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.navy} />
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {products.map((product) => (
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
  seeAll: { flexDirection: 'row', alignItems: 'center' },
  seeAllText: { fontSize: FontSize.body, fontWeight: '600', color: Colors.navy },
  row: { paddingHorizontal: Spacing.md },
  item: { marginRight: Spacing.sm + 2 },
});
