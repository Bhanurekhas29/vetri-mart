// The Categories tab: a grid of the main categories. Tap one to see its products (sub-category chips are on that screen).
import { useQuery } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/button';
import { HeaderActions } from '@/components/header-actions';
import { Picture } from '@/components/picture';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import type { CategoryNode } from '@/lib/types';

const GAP = Spacing.sm + 2;

export default function CategoriesScreen() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const tile = (width - GAP * 3) / 2;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get<CategoryNode[]>('categories/')).data,
  });

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <HeaderActions /> });
  }, [navigation]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{getErrorMessage(error)}</Text>
        <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.retry} />
      </View>
    );
  }
  if (data.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>No categories yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={data}
      numColumns={2}
      columnWrapperStyle={{ gap: GAP }}
      ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
      keyExtractor={(c) => String(c.id)}
      refreshing={false}
      onRefresh={() => refetch()}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/category/${item.slug}`)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}${item.children.length ? `: ${item.children.map((c) => c.name).join(', ')}` : ''}`}
          style={[styles.card, { width: tile }]}>
          <Picture uri={item.image} alt={item.image_alt || item.name} icon="grid-outline" iconSize={36} style={styles.image} />
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.children.length > 0 && (
            <Text style={styles.sub} numberOfLines={2}>
              {item.children.map((c) => c.name).join(', ')}
            </Text>
          )}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: Colors.background },
  content: { padding: GAP },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  message: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center' },
  retry: { marginTop: Spacing.md, alignSelf: 'stretch' },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 1.15, borderRadius: Radius.md },
  name: { marginTop: Spacing.sm, fontSize: FontSize.title - 2, fontWeight: '700', color: Colors.text },
  sub: { marginTop: 2, fontSize: FontSize.caption + 1, color: Colors.textMuted },
});
