// The product detail page. Everything comes from one server call: GET products/<slug>/.
// Top to bottom: pictures, brand and name, rating, price, colour and size choices, stock message, delivery check,
// description and specifications, bundles, reviews, questions, similar products, and a sticky buy bar.
// Adding to the cart is built in the next step (cart and wishlist); the buttons are in place and say so for now.
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { HeartButton } from '@/components/heart-button';
import { BundlesSection } from '@/components/product/bundles-section';
import { DeliveryCheck } from '@/components/product/delivery-check';
import { Gallery } from '@/components/product/gallery';
import { QuestionsSection } from '@/components/product/questions-section';
import { ReviewsSection } from '@/components/product/reviews-section';
import { VariantPicker } from '@/components/product/variant-picker';
import { ProductRowSection } from '@/components/home/product-row-section';
import { Skeleton } from '@/components/skeleton';
import { Stars } from '@/components/stars';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { useCart } from '@/lib/cart';
import { addRecentSlug } from '@/lib/recently-viewed';
import type { Bundle, ProductDetail } from '@/lib/types';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const [chosenId, setChosenId] = useState<number | null>(null);
  const { add, addMany, count: cartCount } = useCart();
  const [adding, setAdding] = useState<'cart' | 'buy' | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // the small "Added to cart" bar

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['product', slug],
    enabled: !!slug,
    queryFn: async () => (await api.get<ProductDetail>(`products/${slug}/`)).data,
  });

  // remember it for the Home page's "Recently viewed" row
  useEffect(() => {
    if (slug) addRecentSlug(slug);
  }, [slug]);

  // the "Added to cart" bar goes away by itself
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function addToCart(variantId: number, stock: number, buyNow: boolean) {
    if (adding) return;
    setAdding(buyNow ? 'buy' : 'cart');
    try {
      const result = await add(variantId, 1, stock);
      if (buyNow) {
        router.push('/cart');
      } else {
        setNotice(result.added.limited_by_stock ? result.added.message : 'Added to cart');
      }
    } catch (e) {
      Alert.alert('Cart', getErrorMessage(e));
    } finally {
      setAdding(null);
    }
  }

  // "Add bundle to cart": every item of the bundle goes in; the saving then appears in the cart by itself
  async function addBundle(bundle: Bundle) {
    try {
      await addMany(bundle.items.map((i) => ({ variantId: i.variant_id, quantity: i.quantity })));
      setNotice(`${bundle.name} added to cart`);
    } catch (e) {
      Alert.alert('Cart', getErrorMessage(e));
    }
  }

  const notFound = isAxiosError(error) && error.response?.status === 404;

  const header = (
    <Stack.Screen
      options={{
        title: '',
        headerRight: () => (
          <View style={styles.headerIcons}>
            {data && <HeartButton product={data} tone="header" size={24} style={styles.headerIcon} />}
            <Pressable
              onPress={() => data && shareProduct(data)}
              disabled={!data}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share this product"
              style={styles.headerIcon}>
              <Ionicons name="share-social-outline" size={22} color={Colors.white} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/cart')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={cartCount > 0 ? `Open cart, ${cartCount} items` : 'Open cart'}
              style={[styles.headerIcon, styles.cartButton]}>
              <Ionicons name="cart-outline" size={24} color={Colors.white} />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        ),
      }}
    />
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {header}
        <Skeleton style={styles.skelImage} />
        <View style={styles.skelBody}>
          <Skeleton style={styles.skelLine} />
          <Skeleton style={[styles.skelLine, styles.skelShort]} />
          <Skeleton style={styles.skelPrice} />
        </View>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.container, styles.center]}>
        {header}
        <Text style={styles.message}>{notFound ? 'This product is not available any more.' : getErrorMessage(error)}</Text>
        {notFound ? (
          <Button title="Back to shopping" variant="secondary" onPress={() => router.replace('/')} style={styles.retry} />
        ) : (
          <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.retry} />
        )}
      </View>
    );
  }

  const selected = data.variants.find((v) => v.id === chosenId) ?? data.variants.find((v) => v.id === data.default_variant_id) ?? data.variants[0];
  const showMrp = Number(selected.mrp) > Number(selected.price);

  // Pictures for the chosen colour come first, then the general ones. If the colour has none, show all.
  const forColour = data.images.filter((i) => i.colour_id !== null && i.colour_id === selected.colour_id);
  const general = data.images.filter((i) => i.colour_id === null);
  const galleryImages = forColour.length + general.length > 0 ? [...forColour, ...general] : data.images;

  const stockColour = !selected.in_stock || selected.stock <= 5 ? Colors.error : Colors.success;

  return (
    <View style={styles.container}>
      {header}
      <ScrollView>
        <Gallery key={selected.colour_id ?? 'all'} images={galleryImages} productName={data.name} videoUrl={data.video_url} />

        <View style={styles.block}>
          <Pressable
            onPress={() => router.push(`/category/${data.category.slug}`)}
            accessibilityRole="link"
            accessibilityLabel={`Category ${data.category.name}`}>
            <Text style={styles.crumb}>
              {data.category.parent ? `${data.category.parent.name} › ` : ''}
              {data.category.name}
            </Text>
          </Pressable>
          {data.brand && <Text style={styles.brand}>{data.brand.name}</Text>}
          <Text style={styles.name} accessibilityRole="header">
            {data.name}
          </Text>
          {data.is_sponsored && (
            <View style={styles.featured}>
              <Text style={styles.featuredText}>Featured</Text>
            </View>
          )}

          {data.rating !== null && (
            <View style={styles.ratingRow} accessible accessibilityLabel={`Rated ${data.rating.toFixed(1)} out of 5 from ${data.rating_count} ratings`}>
              <Stars rating={data.rating} />
              <Text style={styles.ratingText}>
                {data.rating.toFixed(1)} ({data.rating_count})
              </Text>
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatRupees(selected.price)}</Text>
            {showMrp && <Text style={styles.mrp}>{formatRupees(selected.mrp)}</Text>}
            {selected.discount_percent > 0 && (
              <View style={styles.discount}>
                <Text style={styles.discountText}>{selected.discount_percent}% off</Text>
              </View>
            )}
          </View>
          <Text style={styles.tax}>Inclusive of all taxes</Text>

          <VariantPicker
            colours={data.colours}
            sizes={data.sizes}
            variants={data.variants}
            selected={selected}
            onSelect={(v) => setChosenId(v.id)}
          />

          <Text style={[styles.stock, { color: stockColour }]} accessibilityLiveRegion="polite">
            {selected.stock_message}
          </Text>
        </View>

        <DeliveryCheck />

        {(data.description || data.specifications.length > 0) && (
          <View style={styles.section}>
            {data.description ? (
              <>
                <Text style={styles.heading} accessibilityRole="header">
                  Description
                </Text>
                <Text style={styles.description}>{data.description}</Text>
              </>
            ) : null}
            {data.specifications.length > 0 && (
              <>
                <Text style={[styles.heading, data.description ? styles.headingGap : null]} accessibilityRole="header">
                  Specifications
                </Text>
                <View style={styles.specs}>
                  {data.specifications.map((s, i) => (
                    <View key={s.name} style={[styles.specRow, i % 2 === 0 && styles.specRowAlt]}>
                      <Text style={styles.specName}>{s.name}</Text>
                      <Text style={styles.specValue}>{s.value}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        <BundlesSection bundles={data.bundles} onAddBundle={addBundle} />
        <ReviewsSection product={data} />
        <QuestionsSection slug={data.slug} questions={data.questions} />

        {data.similar.length > 0 && (
          <ProductRowSection
            title="Similar products"
            collection={{ slug: '', name: 'Similar products' }}
            products={data.similar}
            hasMore={false}
          />
        )}
        <View style={{ height: 96 + insets.bottom }} />
      </ScrollView>

      {notice && (
        <View style={[styles.notice, { bottom: 76 + insets.bottom }]} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
          <Text style={styles.noticeText}>{notice}</Text>
          <Pressable onPress={() => router.push('/cart')} accessibilityRole="button" accessibilityLabel="View cart" hitSlop={8}>
            <Text style={styles.noticeLink}>View cart</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.bar, { paddingBottom: Spacing.sm + insets.bottom }]}>
        {selected.in_stock ? (
          <>
            <Button
              title="Add to cart"
              variant="secondary"
              loading={adding === 'cart'}
              disabled={adding !== null}
              onPress={() => addToCart(selected.id, selected.stock, false)}
              style={styles.barButton}
            />
            <Button
              title="Buy now"
              loading={adding === 'buy'}
              disabled={adding !== null}
              onPress={() => addToCart(selected.id, selected.stock, true)}
              style={styles.barButton}
            />
          </>
        ) : (
          <Button title="Out of stock" onPress={() => undefined} disabled style={styles.barButton} />
        )}
      </View>
    </View>
  );
}

async function shareProduct(product: ProductDetail) {
  const variant = product.variants.find((v) => v.id === product.default_variant_id) ?? product.variants[0];
  const picture = product.images[0]?.url;
  const lines = [`${product.name} - ${formatRupees(variant.price)} on Vetri Mart`, picture].filter(Boolean);
  try {
    await Share.share({ message: lines.join('\n') });
  } catch {
    // closing the share sheet is not an error
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  message: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center' },
  retry: { marginTop: Spacing.md, alignSelf: 'stretch' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { marginLeft: Spacing.md },
  skelImage: { width: '100%', height: 320, borderRadius: 0 },
  skelBody: { padding: Spacing.md },
  skelLine: { height: 18, marginBottom: Spacing.sm },
  skelShort: { width: '60%' },
  skelPrice: { width: 140, height: 28, marginTop: Spacing.sm },
  block: { backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  crumb: { fontSize: FontSize.caption, color: Colors.textMuted },
  brand: { marginTop: Spacing.sm, fontSize: FontSize.body, fontWeight: '600', color: Colors.navy },
  name: { marginTop: 2, fontSize: FontSize.heading - 2, fontWeight: '600', color: Colors.text },
  featured: { alignSelf: 'flex-start', marginTop: Spacing.sm, backgroundColor: Colors.orange, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  featuredText: { color: Colors.white, fontSize: FontSize.caption, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  ratingText: { marginLeft: Spacing.sm, fontSize: FontSize.body, color: Colors.success, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: Spacing.md },
  price: { fontSize: 28, fontWeight: '700', color: Colors.text },
  mrp: { marginLeft: Spacing.sm, fontSize: FontSize.title - 2, color: Colors.textMuted, textDecorationLine: 'line-through' },
  discount: { marginLeft: Spacing.sm, backgroundColor: Colors.success, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  discountText: { color: Colors.white, fontSize: FontSize.caption + 1, fontWeight: '700' },
  tax: { fontSize: FontSize.caption, color: Colors.textMuted, marginTop: 2 },
  stock: { marginTop: Spacing.sm, fontSize: FontSize.title - 2, fontWeight: '600' },
  section: { backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  heading: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text },
  headingGap: { marginTop: Spacing.lg },
  description: { marginTop: Spacing.sm, fontSize: FontSize.body, color: Colors.text, lineHeight: 21 },
  specs: { marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden' },
  specRow: { flexDirection: 'row', paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md },
  specRowAlt: { backgroundColor: Colors.background },
  specName: { width: '40%', fontSize: FontSize.body, color: Colors.textMuted },
  specValue: { flex: 1, fontSize: FontSize.body, color: Colors.text },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  barButton: { flex: 1, marginHorizontal: Spacing.xs },
  notice: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  noticeText: { flex: 1, marginLeft: Spacing.sm, color: Colors.white, fontSize: FontSize.body },
  noticeLink: { color: Colors.white, fontSize: FontSize.body, fontWeight: '700', textDecorationLine: 'underline' },
  // The top bar cuts off anything that sticks out of the icon, so the button has room for the badge inside it.
  cartButton: { paddingTop: 8, paddingRight: 10 },
  cartBadge: { position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
});
