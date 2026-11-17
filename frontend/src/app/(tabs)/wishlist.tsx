// The Wishlist tab: the products the shopper has saved, in a two-column grid.
// Labels: "Price dropped" (cheaper now than when saved), "Only N left", "Out of stock".
// Guests are asked to log in. "Move to cart" adds a one-version product and removes it from here;
// a product with several versions opens its page to choose colour and size.
import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/button';
import { ProductTile } from '@/components/product-tile';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { formatRupees } from '@/lib/format';
import type { WishlistItem } from '@/lib/types';
import { useWishlist } from '@/lib/wishlist';

const GAP = Spacing.sm + 2;

function MoveToCart({ item }: { item: WishlistItem }) {
  const { add } = useCart();
  const { remove } = useWishlist();
  const [busy, setBusy] = useState(false);
  const { product, single_variant_id: variantId } = item;

  async function move() {
    if (busy) return;
    if (variantId === null) {
      router.push(`/product/${product.slug}`); // several versions: choose colour and size first
      return;
    }
    setBusy(true);
    try {
      await add(variantId, 1);
      await remove(product); // moved, so it leaves the wishlist
    } catch (e) {
      Alert.alert('Cart', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      onPress={move}
      disabled={!product.in_stock || busy}
      accessibilityRole="button"
      accessibilityLabel={variantId === null ? `Choose options for ${product.name}` : `Move ${product.name} to cart`}
      style={[styles.move, (!product.in_stock || busy) && styles.moveOff]}>
      <Text style={styles.moveText}>{variantId === null ? 'Choose options' : 'Move to cart'}</Text>
    </Pressable>
  );
}

function Labels({ item }: { item: WishlistItem }) {
  return (
    <View style={styles.labels}>
      {item.price_dropped && (
        <View style={[styles.label, styles.dropped]}>
          <Ionicons name="trending-down" size={12} color={Colors.white} />
          <Text style={styles.labelText}>Price dropped from {formatRupees(item.saved_price)}</Text>
        </View>
      )}
      {item.only_left !== null && item.product.in_stock && <Text style={styles.onlyLeft}>Only {item.only_left} left</Text>}
      <MoveToCart item={item} />
    </View>
  );
}

export default function WishlistScreen() {
  const navigation = useNavigation();
  const { signedIn, items, count, isLoading, isError, error, refetch, remove } = useWishlist();
  const { width } = useWindowDimensions();
  const cardWidth = (width - GAP * 3) / 2;

  useEffect(() => {
    navigation.setOptions({ headerTitle: signedIn && count > 0 ? `My wishlist (${count})` : 'My wishlist' });
  }, [navigation, signedIn, count]);

  if (!signedIn) {
    return (
      <View style={styles.center}>
        <Ionicons name="heart-outline" size={56} color={Colors.textMuted} />
        <Text style={styles.title}>Save items you love</Text>
        <Text style={styles.note}>Log in to keep a wishlist you can see on any phone.</Text>
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
  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.note}>{getErrorMessage(error)}</Text>
        <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.cta} />
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="heart-outline" size={56} color={Colors.textMuted} />
        <Text style={styles.title}>Save items you love</Text>
        <Text style={styles.note}>Tap the heart on a product to keep it here.</Text>
        <Button title="Start shopping" onPress={() => router.navigate('/(tabs)')} style={styles.cta} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={items}
      numColumns={2}
      columnWrapperStyle={{ gap: GAP }}
      ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
      keyExtractor={(item) => String(item.product.id)}
      onRefresh={() => refetch()}
      refreshing={false}
      renderItem={({ item }) => (
        <ProductTile
          product={item.product}
          width={cardWidth}
          extra={<Labels item={item} />}
          onRemove={() => remove(item.product).catch((e) => Alert.alert('Wishlist', getErrorMessage(e)))}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: Colors.background },
  content: { padding: GAP },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  title: { fontSize: FontSize.heading, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
  note: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  cta: { marginTop: Spacing.lg, alignSelf: 'stretch' },
  labels: { marginTop: Spacing.xs },
  label: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  dropped: { backgroundColor: Colors.success },
  labelText: { color: Colors.white, fontSize: 10, fontWeight: '700', marginLeft: 3 },
  move: { marginTop: Spacing.sm, borderWidth: 1.5, borderColor: Colors.navy, borderRadius: Radius.md, paddingVertical: 8, alignItems: 'center' },
  moveOff: { opacity: 0.4 },
  moveText: { fontSize: FontSize.body, fontWeight: '600', color: Colors.navy },
  onlyLeft: { fontSize: FontSize.caption, color: Colors.error, fontWeight: '600', marginTop: 2 },
});
