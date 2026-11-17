// "See all reviews" for one product: newest first, loading more as you scroll.
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { ReviewItem } from '@/components/product/reviews-section';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import type { Review } from '@/lib/types';

type Page = { results: Review[]; next_page: number | null };

export default function AllReviewsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['reviews', slug],
    enabled: !!slug,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => (await api.get<Page>(`products/${slug}/reviews/`, { params: { page: pageParam } })).data,
    getNextPageParam: (last) => last.next_page ?? undefined,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{getErrorMessage(error)}</Text>
        <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.retry} />
      </View>
    );
  }

  const reviews = data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={reviews}
      keyExtractor={(r) => String(r.id)}
      renderItem={({ item }) => <ReviewItem review={item} />}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text style={styles.message}>No reviews yet.</Text>}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={Colors.navy} style={styles.footer} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: Colors.white },
  content: { paddingHorizontal: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  message: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
  retry: { marginTop: Spacing.md, alignSelf: 'stretch' },
  footer: { marginVertical: Spacing.md },
});
