// Profile > My reviews: everything the shopper has reviewed. Tap one to edit or delete it.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Picture } from '@/components/picture';
import { Stars } from '@/components/stars';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import type { MyReview } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';

export default function MyReviewsScreen() {
  const { status } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-reviews'],
    enabled: status === 'signedIn',
    queryFn: async () => (await api.get<{ results: MyReview[] }>('me/reviews/')).data.results,
  });

  if (status !== 'signedIn') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Log in to see your reviews.</Text>
        <Button title="Log in" onPress={() => router.push('/login')} style={styles.cta} />
      </View>
    );
  }
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
        <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.cta} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={data}
      keyExtractor={(r) => String(r.id)}
      refreshing={false}
      onRefresh={() => refetch()}
      contentContainerStyle={data.length === 0 ? styles.emptyWrap : styles.content}
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons name="star-outline" size={56} color={Colors.textMuted} />
          <Text style={styles.title}>No reviews yet</Text>
          <Text style={styles.message}>After an order is delivered, you can rate what you bought from the Orders tab.</Text>
          <Button title="Go to my orders" onPress={() => router.navigate('/(tabs)/orders')} style={styles.cta} />
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/review/${item.product.slug}`)}
          accessibilityRole="button"
          accessibilityLabel={`${item.product.name}, ${item.rating} stars. Tap to edit`}
          style={styles.card}>
          <View style={styles.top}>
            <Picture uri={item.product.image} alt={item.product.image_alt || item.product.name} contentFit="contain" icon="cube-outline" style={styles.image} />
            <View style={styles.topBody}>
              <Text style={styles.name} numberOfLines={2}>
                {item.product.name}
              </Text>
              <View style={styles.starRow}>
                <Stars rating={item.rating} size={16} />
                <Text style={styles.date}>{formatDate(item.created_at)}</Text>
              </View>
            </View>
            <Ionicons name="create-outline" size={20} color={Colors.navy} />
          </View>
          {item.title ? <Text style={styles.reviewTitle}>{item.title}</Text> : null}
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
          {!item.is_visible && <Text style={styles.hidden}>This review is hidden from other shoppers.</Text>}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: Colors.background },
  content: { paddingBottom: Spacing.xl },
  emptyWrap: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  title: { fontSize: FontSize.heading, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
  message: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  cta: { marginTop: Spacing.lg, alignSelf: 'stretch' },
  card: { backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  top: { flexDirection: 'row', alignItems: 'center' },
  image: { width: 52, height: 52, borderRadius: Radius.md },
  topBody: { flex: 1, marginHorizontal: Spacing.md },
  name: { fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  starRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  date: { marginLeft: Spacing.sm, fontSize: FontSize.caption + 1, color: Colors.textMuted },
  reviewTitle: { marginTop: Spacing.md, fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  body: { marginTop: Spacing.xs, fontSize: FontSize.body, color: Colors.text, lineHeight: 20 },
  hidden: { marginTop: Spacing.sm, fontSize: FontSize.caption + 1, color: Colors.error },
});
