// The small product card used on Home, and later in lists, search and the wishlist.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HeartButton } from '@/components/heart-button';
import { Picture } from '@/components/picture';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatRupees } from '@/lib/format';
import { addRecentSlug } from '@/lib/recently-viewed';
import type { ProductCard } from '@/lib/types';

type Props = {
  product: ProductCard;
  width?: number;
  // Wishlist tab: show a remove (X) button instead of the heart, and extra labels under the price.
  onRemove?: () => void;
  extra?: React.ReactNode;
};

export function ProductTile({ product, width = 150, onRemove, extra }: Props) {
  const showMrp = Number(product.mrp) > Number(product.price);

  const summary = [
    product.name,
    `${product.price_from ? 'from ' : ''}${formatRupees(product.price)}`,
    product.discount_percent > 0 ? `${product.discount_percent} percent off` : null,
    product.is_sponsored ? 'Featured' : null,
    product.in_stock ? null : 'Out of stock',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => {
        addRecentSlug(product.slug); // remembered on this phone for the "Recently viewed" row
        router.push(`/product/${product.slug}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={summary}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}>
      <View>
        <Picture
          uri={product.image}
          alt={product.image_alt || product.name}
          contentFit="contain"
          icon="cube-outline"
          iconSize={32}
          style={[styles.image, !product.in_stock && styles.dim]}
        />
        {product.discount_percent > 0 && (
          <View style={[styles.badge, styles.discountBadge]}>
            <Text style={styles.badgeText}>{product.discount_percent}% off</Text>
          </View>
        )}
        {/* The setting is called is_sponsored inside the code; shoppers see the word "Featured". */}
        {product.is_sponsored && (
          <View style={[styles.badge, styles.featuredBadge]}>
            <Text style={styles.badgeText}>Featured</Text>
          </View>
        )}
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${product.name} from wishlist`}
            style={styles.corner}>
            <Ionicons name="close" size={16} color={Colors.textMuted} />
          </Pressable>
        ) : (
          <HeartButton product={product} style={styles.corner} />
        )}
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>

      {product.in_stock ? (
        product.rating !== null && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={Colors.success} />
            <Text style={styles.rating}>
              {product.rating.toFixed(1)} ({product.rating_count})
            </Text>
          </View>
        )
      ) : (
        <Text style={styles.outOfStock}>Out of stock</Text>
      )}

      <View style={styles.priceRow}>
        {product.price_from && <Text style={styles.from}>From </Text>}
        <Text style={styles.price}>{formatRupees(product.price)}</Text>
        {showMrp && <Text style={styles.mrp}>{formatRupees(product.mrp)}</Text>}
      </View>
      {extra}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  pressed: { opacity: 0.85 },
  image: { width: '100%', aspectRatio: 1, borderRadius: Radius.md },
  dim: { opacity: 0.45 },
  badge: { position: 'absolute', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  discountBadge: { top: 4, left: 4, backgroundColor: Colors.success },
  featuredBadge: { bottom: 4, left: 4, backgroundColor: Colors.orange },
  corner: { position: 'absolute', top: 4, right: 4, width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  name: { marginTop: Spacing.sm, fontSize: FontSize.body, color: Colors.text, minHeight: 36 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  rating: { marginLeft: 3, fontSize: FontSize.caption, color: Colors.success },
  outOfStock: { marginTop: 2, fontSize: FontSize.caption, color: Colors.error, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4, flexWrap: 'wrap' },
  from: { fontSize: FontSize.caption, color: Colors.textMuted },
  price: { fontSize: FontSize.title - 2, fontWeight: '700', color: Colors.text },
  mrp: { marginLeft: 6, fontSize: FontSize.caption, color: Colors.textMuted, textDecorationLine: 'line-through' },
});
