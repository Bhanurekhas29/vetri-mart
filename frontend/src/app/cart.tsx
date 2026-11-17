// The cart screen. Prices and stock are always today's: the server works out every line and the totals.
// Guests have a cart too (kept on this phone); it joins their account when they log in.
// A line with a problem (out of stock, more than the stock, no longer sold) is marked in red and blocks Place order.
// "Save for later" moves a line below the cart, out of the totals; "Move to cart" brings it back.
// Checkout is built in the next slice, so Place order says so for now.
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PincodeBar } from '@/components/home/pincode-bar';
import { BundleSuggestions } from '@/components/cart/bundle-suggestions';
import { CouponBox } from '@/components/cart/coupon-box';
import { Picture } from '@/components/picture';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/api';
import { setPostLoginRoute } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatRupees } from '@/lib/format';
import type { CartLine, CartSummary } from '@/lib/types';

function issueText(line: CartLine, saved: boolean): string | null {
  if (line.issue === 'unavailable') return saved ? 'No longer available.' : 'No longer available. Remove it to continue.';
  if (line.issue === 'out_of_stock') return saved ? 'Out of stock.' : 'Out of stock. Remove it to continue.';
  if (line.issue === 'low_stock') return `Only ${line.max_quantity} left. Lower the quantity to continue.`;
  return null;
}

// Runs an action with a busy lock and shows the server's message if it fails.
function useBusy() {
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      Alert.alert('Cart', e instanceof Error && !('response' in e) ? e.message : getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

function LinkButton({ icon, label, color, onPress, disabled, a11y }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; color: string; onPress: () => void; disabled?: boolean; a11y: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={a11y} style={[styles.linkButton, disabled && styles.dim]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.linkText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function CartLineCard({ line }: { line: CartLine }) {
  const { setQuantity, removeLine, saveForLater } = useCart();
  const { busy, run } = useBusy();
  const problem = issueText(line, false);
  const canChange = line.issue !== 'unavailable' && line.issue !== 'out_of_stock';
  const showMrp = Number(line.mrp) > Number(line.price);

  return (
    <View style={[styles.card, !!problem && styles.cardProblem]}>
      <View style={styles.cardTop}>
        <Pressable onPress={() => router.push(`/product/${line.product_slug}`)} accessibilityRole="button" accessibilityLabel={`Open ${line.name}`}>
          <Picture uri={line.image} alt={line.image_alt} contentFit="contain" icon="cube-outline" style={[styles.image, !!problem && styles.dim]} />
        </Pressable>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {line.name}
          </Text>
          {line.label ? <Text style={styles.label}>{line.label}</Text> : null}

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatRupees(line.price)}</Text>
            {showMrp && <Text style={styles.mrp}>{formatRupees(line.mrp)}</Text>}
            {line.discount_percent > 0 && <Text style={styles.off}>{line.discount_percent}% off</Text>}
          </View>

          {line.price_dropped_from && <Text style={styles.dropped}>Price dropped from {formatRupees(line.price_dropped_from)}</Text>}
          {problem ? (
            <Text style={styles.problem} accessibilityLiveRegion="polite">
              {problem}
            </Text>
          ) : line.low_stock ? (
            <Text style={styles.problem}>Only {line.stock} left</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <View style={[styles.stepper, (!canChange || busy) && styles.dim]}>
          <Pressable
            onPress={() => run(() => setQuantity(line.id, line.quantity - 1))}
            disabled={!canChange || busy || line.quantity <= 1}
            accessibilityRole="button"
            accessibilityLabel={`Decrease quantity of ${line.name}`}
            style={styles.stepButton}>
            <Ionicons name="remove" size={18} color={line.quantity <= 1 ? Colors.border : Colors.navy} />
          </Pressable>
          <Text style={styles.quantity} accessibilityLabel={`Quantity ${line.quantity}`}>
            {line.quantity}
          </Text>
          <Pressable
            onPress={() => run(() => setQuantity(line.id, line.quantity + 1))}
            disabled={!canChange || busy || line.quantity >= line.max_quantity}
            accessibilityRole="button"
            accessibilityLabel={`Increase quantity of ${line.name}`}
            style={styles.stepButton}>
            <Ionicons name="add" size={18} color={line.quantity >= line.max_quantity ? Colors.border : Colors.navy} />
          </Pressable>
        </View>

        <Text style={styles.lineTotal}>{formatRupees(line.line_total)}</Text>
      </View>

      <View style={styles.linkRow}>
        <LinkButton icon="bookmark-outline" label="Save for later" color={Colors.navy} disabled={busy} a11y={`Save ${line.name} for later`} onPress={() => run(() => saveForLater(line.id))} />
        <LinkButton icon="trash-outline" label="Remove" color={Colors.error} disabled={busy} a11y={`Remove ${line.name} from cart`} onPress={() => run(() => removeLine(line.id))} />
      </View>
    </View>
  );
}

function SavedLineCard({ line }: { line: CartLine }) {
  const { moveToCart, removeLine } = useCart();
  const { busy, run } = useBusy();
  const problem = issueText(line, true);
  const showMrp = Number(line.mrp) > Number(line.price);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Pressable onPress={() => router.push(`/product/${line.product_slug}`)} accessibilityRole="button" accessibilityLabel={`Open ${line.name}`}>
          <Picture uri={line.image} alt={line.image_alt} contentFit="contain" icon="cube-outline" style={[styles.image, !!problem && styles.dim]} />
        </Pressable>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {line.name}
          </Text>
          {line.label ? <Text style={styles.label}>{line.label}</Text> : null}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatRupees(line.price)}</Text>
            {showMrp && <Text style={styles.mrp}>{formatRupees(line.mrp)}</Text>}
          </View>
          <Text style={styles.label}>Quantity {line.quantity}</Text>
          {problem ? <Text style={styles.problem}>{problem}</Text> : null}
        </View>
      </View>
      <View style={styles.linkRow}>
        <LinkButton icon="cart-outline" label="Move to cart" color={Colors.navy} disabled={busy} a11y={`Move ${line.name} to cart`} onPress={() => run(() => moveToCart(line.id))} />
        <LinkButton icon="trash-outline" label="Remove" color={Colors.error} disabled={busy} a11y={`Remove ${line.name}`} onPress={() => run(() => removeLine(line.id))} />
      </View>
    </View>
  );
}

function PriceDetails({ summary }: { summary: CartSummary }) {
  const free = Number(summary.delivery_fee) === 0;
  return (
    <View style={styles.details}>
      <Text style={styles.detailsTitle} accessibilityRole="header">
        Price details
      </Text>
      <Row label={`Price (${summary.units} ${summary.units === 1 ? 'item' : 'items'})`} value={formatRupees(summary.mrp_total)} />
      {Number(summary.discount) > 0 && <Row label="Discount" value={`- ${formatRupees(summary.discount)}`} good />}
      {Number(summary.bundle_savings) > 0 && <Row label="Bundle savings" value={`- ${formatRupees(summary.bundle_savings)}`} good />}
      {Number(summary.coupon_discount) > 0 && <Row label={`Coupon ${summary.coupon_code}`} value={`- ${formatRupees(summary.coupon_discount)}`} good />}
      <Row label="Delivery" value={free ? 'Free' : formatRupees(summary.delivery_fee)} good={free} />
      {!free && Number(summary.subtotal) > 0 && <Text style={styles.hint}>Free delivery on orders of {formatRupees(summary.free_delivery_above)} or more.</Text>}
      <View style={styles.divider} />
      <Row label="Total" value={formatRupees(summary.total)} bold />
      {Number(summary.you_save) > 0 && <Text style={styles.save}>You save {formatRupees(summary.you_save)} on this order</Text>}
    </View>
  );
}

function Row({ label, value, good, bold }: { label: string; value: string; good?: boolean; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, good && styles.good, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { signedIn, cart, isLoading, isError, error, refetch, applyCoupon, removeCoupon, addMany } = useCart();
  const title = cart && cart.count > 0 ? `My cart (${cart.count})` : 'My cart';
  const header = <Stack.Screen options={{ title }} />;

  if (isLoading) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }
  if (isError || !cart) {
    return (
      <View style={styles.center}>
        {header}
        <Text style={styles.emptyNote}>{getErrorMessage(error)}</Text>
        <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.cta} />
      </View>
    );
  }
  if (cart.items.length === 0 && cart.saved_items.length === 0) {
    return (
      <View style={styles.center}>
        {header}
        <Ionicons name="cart-outline" size={56} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptyNote}>Add something you like and it will wait for you here.</Text>
        <Button title="Start shopping" onPress={() => router.navigate('/(tabs)')} style={styles.cta} />
      </View>
    );
  }

  const hasItems = cart.items.length > 0;

  function placeOrder() {
    if (!signedIn) {
      // checkout needs an account: log in, then come back to the cart
      setPostLoginRoute('/cart');
      router.push('/login');
      return;
    }
    router.push('/checkout');
  }

  return (
    <View style={styles.container}>
      {header}
      <FlatList
        data={cart.items}
        keyExtractor={(line) => String(line.id)}
        refreshing={false}
        onRefresh={() => refetch()}
        ListHeaderComponent={
          <View>
            <PincodeBar />
            {!signedIn && (
              <Pressable onPress={() => router.push('/login')} accessibilityRole="button" style={styles.guestBanner}>
                <Ionicons name="person-circle-outline" size={20} color={Colors.navy} />
                <Text style={styles.guestText}>Log in to keep this cart on all your devices</Text>
                <Text style={styles.guestLink}>Log in</Text>
              </Pressable>
            )}
            {!hasItems && <Text style={styles.noItems}>Nothing in your cart right now.</Text>}
          </View>
        }
        renderItem={({ item }) => <CartLineCard line={item} />}
        ListFooterComponent={
          <View>
            {hasItems && (
              <View>
                <BundleSuggestions suggestions={cart.bundle_suggestions} addItems={addMany} />
                <CouponBox signedIn={signedIn} coupon={cart.coupon} apply={applyCoupon} remove={removeCoupon} />
                <PriceDetails summary={cart.summary} />
              </View>
            )}
            {cart.saved_items.length > 0 && (
              <View style={styles.savedSection}>
                <Text style={styles.savedTitle} accessibilityRole="header">
                  Saved for later ({cart.saved_items.length})
                </Text>
                {cart.saved_items.map((line) => (
                  <SavedLineCard key={line.id} line={line} />
                ))}
              </View>
            )}
          </View>
        }
        contentContainerStyle={{ paddingBottom: (hasItems ? 110 : 24) + insets.bottom }}
      />

      {hasItems && (
        <View style={[styles.bar, { paddingBottom: Spacing.sm + insets.bottom }]}>
          {!cart.can_checkout && cart.blocking_lines > 0 && <Text style={styles.barHint}>Fix the items marked in red to continue.</Text>}
          <View style={styles.barRow}>
            <View style={styles.barTotal}>
              <Text style={styles.barTotalLabel}>Total</Text>
              <Text style={styles.barTotalValue}>{formatRupees(cart.summary.total)}</Text>
            </View>
            <Button title={signedIn ? 'Place order' : 'Log in to order'} disabled={!cart.can_checkout} onPress={placeOrder} style={styles.placeOrder} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  emptyTitle: { fontSize: FontSize.heading, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
  emptyNote: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  cta: { marginTop: Spacing.lg, alignSelf: 'stretch' },
  guestBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, padding: Spacing.md, marginTop: Spacing.sm },
  guestText: { flex: 1, marginLeft: Spacing.sm, fontSize: FontSize.body, color: Colors.text },
  guestLink: { fontSize: FontSize.body, fontWeight: '700', color: Colors.navy, textDecorationLine: 'underline' },
  noItems: { padding: Spacing.md, fontSize: FontSize.body, color: Colors.textMuted },
  card: { backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  cardProblem: { borderLeftWidth: 4, borderLeftColor: Colors.error },
  cardTop: { flexDirection: 'row' },
  image: { width: 84, height: 84, borderRadius: Radius.md },
  dim: { opacity: 0.45 },
  info: { flex: 1, marginLeft: Spacing.md },
  name: { fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  label: { fontSize: FontSize.caption + 1, color: Colors.textMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: Spacing.xs },
  price: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  mrp: { marginLeft: Spacing.sm, fontSize: FontSize.caption + 1, color: Colors.textMuted, textDecorationLine: 'line-through' },
  off: { marginLeft: Spacing.sm, fontSize: FontSize.caption + 1, color: Colors.success, fontWeight: '700' },
  dropped: { marginTop: 2, fontSize: FontSize.caption + 1, color: Colors.success, fontWeight: '600' },
  problem: { marginTop: 2, fontSize: FontSize.caption + 1, color: Colors.error, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  stepButton: { width: 38, height: 36, alignItems: 'center', justifyContent: 'center' },
  quantity: { minWidth: 28, textAlign: 'center', fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  lineTotal: { flex: 1, textAlign: 'right', fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  linkRow: { flexDirection: 'row', marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  linkButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xs },
  linkText: { marginLeft: 6, fontSize: FontSize.body, fontWeight: '600' },
  details: { backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  detailsTitle: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  rowLabel: { fontSize: FontSize.body + 1, color: Colors.text },
  rowValue: { fontSize: FontSize.body + 1, color: Colors.text },
  good: { color: Colors.success, fontWeight: '600' },
  bold: { fontSize: FontSize.title, fontWeight: '700' },
  hint: { marginTop: 2, fontSize: FontSize.caption, color: Colors.textMuted },
  divider: { height: 1, backgroundColor: Colors.border, marginTop: Spacing.md },
  save: { marginTop: Spacing.md, fontSize: FontSize.body, color: Colors.success, fontWeight: '600' },
  savedSection: { marginTop: Spacing.md },
  savedTitle: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text, paddingHorizontal: Spacing.md },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  barHint: { fontSize: FontSize.caption + 1, color: Colors.error, marginBottom: Spacing.xs },
  barRow: { flexDirection: 'row', alignItems: 'center' },
  barTotal: { flex: 1 },
  barTotalLabel: { fontSize: FontSize.caption, color: Colors.textMuted },
  barTotalValue: { fontSize: FontSize.heading, fontWeight: '700', color: Colors.text },
  placeOrder: { flex: 1 },
});
