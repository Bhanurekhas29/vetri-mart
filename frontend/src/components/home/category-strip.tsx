// The row of round category tiles. A tile with no picture yet shows a grey placeholder.
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Picture } from '@/components/picture';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import type { CategoryTile } from '@/lib/types';

const SIZE = 60;

export function CategoryStrip({ categories }: { categories: CategoryTile[] }) {
  return (
    <View style={styles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {categories.map((category) => (
          <Pressable
            key={category.id}
            onPress={() => router.push(`/category/${category.slug}`)}
            accessibilityRole="button"
            accessibilityLabel={category.name}
            style={styles.tile}>
            <Picture
              uri={category.icon}
              alt={category.icon_alt}
              icon="grid-outline"
              iconSize={26}
              style={styles.circle}
            />
            <Text style={styles.label} numberOfLines={2}>
              {category.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: Colors.white, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  row: { paddingHorizontal: Spacing.md },
  tile: { width: 76, alignItems: 'center', marginRight: Spacing.sm },
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 1, borderColor: Colors.border },
  label: { marginTop: Spacing.xs + 2, fontSize: FontSize.caption, color: Colors.text, textAlign: 'center' },
});
