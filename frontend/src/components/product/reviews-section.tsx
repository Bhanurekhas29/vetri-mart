// Ratings and reviews: the average, a bar for each star count, the latest reviews, and "See all".
// Real reviews carry a "Verified purchase" tag (the buyer's order was marked Delivered by the admin).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Stars } from '@/components/stars';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { ProductDetail, Review } from '@/lib/types';

export function formatReviewDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ReviewItem({ review }: { review: Review }) {
  return (
    <View style={styles.review} accessible accessibilityLabel={`${review.name}, ${review.rating} out of 5 stars. ${review.title}. ${review.body}`}>
      <View style={styles.reviewTop}>
        <View style={styles.ratingPill}>
          <Text style={styles.ratingPillText}>{review.rating}</Text>
          <Ionicons name="star" size={11} color={Colors.white} />
        </View>
        {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
      </View>
      {review.body ? <Text style={styles.reviewBody}>{review.body}</Text> : null}
      <View style={styles.reviewMeta}>
        <Text style={styles.metaText}>
          {review.name} · {formatReviewDate(review.created_at)}
        </Text>
        {review.verified_purchase && (
          <View style={styles.verified}>
            <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
            <Text style={styles.verifiedText}>Verified purchase</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function ReviewsSection({ product }: { product: ProductDetail }) {
  const { rating, rating_count: count, rating_breakdown: breakdown, reviews } = product;

  return (
    <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        Ratings and reviews
      </Text>

      {count === 0 || rating === null ? (
        <Text style={styles.empty}>No reviews yet.</Text>
      ) : (
        <>
          <View style={styles.summary}>
            <View style={styles.big}>
              <Text style={styles.bigNumber}>{rating.toFixed(1)}</Text>
              <Stars rating={rating} size={16} />
              <Text style={styles.count}>
                {count} {count === 1 ? 'rating' : 'ratings'}
              </Text>
            </View>
            <View style={styles.bars}>
              {(['5', '4', '3', '2', '1'] as const).map((star) => {
                const n = breakdown[star];
                return (
                  <View key={star} style={styles.barRow} accessible accessibilityLabel={`${star} stars: ${n}`}>
                    <Text style={styles.barLabel}>{star}★</Text>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${(n / count) * 100}%` }]} />
                    </View>
                    <Text style={styles.barCount}>{n}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {reviews.map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}

          {count > reviews.length && (
            <Pressable
              onPress={() => router.push(`/reviews/${product.slug}`)}
              accessibilityRole="button"
              accessibilityLabel={`See all ${count} reviews`}
              style={styles.seeAll}>
              <Text style={styles.seeAllText}>See all {count} reviews</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.navy} />
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  heading: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text },
  empty: { marginTop: Spacing.sm, fontSize: FontSize.body, color: Colors.textMuted },
  summary: { flexDirection: 'row', marginTop: Spacing.md, marginBottom: Spacing.sm },
  big: { alignItems: 'center', justifyContent: 'center', width: 110 },
  bigNumber: { fontSize: 34, fontWeight: '700', color: Colors.text },
  count: { fontSize: FontSize.caption, color: Colors.textMuted, marginTop: 2 },
  bars: { flex: 1, justifyContent: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  barLabel: { width: 26, fontSize: FontSize.caption, color: Colors.textMuted },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.navySoft, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: Colors.success },
  barCount: { width: 24, textAlign: 'right', fontSize: FontSize.caption, color: Colors.textMuted },
  review: { paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  reviewTop: { flexDirection: 'row', alignItems: 'center' },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: Spacing.sm,
  },
  ratingPillText: { color: Colors.white, fontSize: FontSize.caption, fontWeight: '700', marginRight: 2 },
  reviewTitle: { flex: 1, fontSize: FontSize.body, fontWeight: '600', color: Colors.text },
  reviewBody: { marginTop: Spacing.xs + 2, fontSize: FontSize.body, color: Colors.text, lineHeight: 20 },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: Spacing.xs + 2 },
  metaText: { fontSize: FontSize.caption, color: Colors.textMuted, marginRight: Spacing.sm },
  verified: { flexDirection: 'row', alignItems: 'center' },
  verifiedText: { fontSize: FontSize.caption, color: Colors.success, marginLeft: 3, fontWeight: '600' },
  seeAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  seeAllText: { fontSize: FontSize.body, fontWeight: '600', color: Colors.navy },
});
