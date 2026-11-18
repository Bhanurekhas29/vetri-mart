// A gentle nudge on Home: when something has been in a logged-in shopper's cart for more than a day.
// It is shown once; after the shopper taps "View cart" or the close button it stays quiet for three days.
// (Guests' carts live on the phone and have no time stamp, so there is no reminder for them. No push notification yet.)
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/lib/cart';
import { getText, setText } from '@/lib/storage';

const WAITING_MS = 24 * 60 * 60 * 1000; // in the cart for more than a day
const QUIET_MS = 3 * 24 * 60 * 60 * 1000; // after a tap or a close: quiet for three days
const KEY = 'cart_reminder_at';

export function CartReminder() {
  const { cart, signedIn } = useCart();
  const [quiet, setQuiet] = useState<boolean | null>(null); // null until the phone's memory has been read

  useEffect(() => {
    let cancelled = false;
    getText(KEY).then((text) => {
      if (cancelled) return;
      const last = text ? Number(text) : 0;
      setQuiet(last > 0 && Date.now() - last < QUIET_MS);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!signedIn || quiet !== false || !cart || cart.items.length === 0) return null;
  const times = cart.items.map((i) => (i.added_at ? new Date(i.added_at).getTime() : NaN)).filter((t) => !Number.isNaN(t));
  if (times.length === 0 || Date.now() - Math.min(...times) < WAITING_MS) return null;

  const units = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  async function done(openCart: boolean) {
    setQuiet(true);
    await setText(KEY, String(Date.now()));
    if (openCart) router.push('/cart');
  }

  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.emoji}>🛒</Text>
      <View style={styles.body}>
        <Text style={styles.title}>Your cart is waiting</Text>
        <Text style={styles.text}>
          {units === 1 ? 'The item you picked is' : `The ${units} items you picked are`} still in your cart. Ready when you are!
        </Text>
      </View>
      <Pressable onPress={() => done(true)} accessibilityRole="button" accessibilityLabel="View cart" style={styles.button}>
        <Text style={styles.buttonText}>View cart</Text>
      </Pressable>
      <Pressable onPress={() => done(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close this reminder" style={styles.close}>
        <Ionicons name="close" size={18} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
  },
  emoji: { fontSize: 24 },
  body: { flex: 1, marginHorizontal: Spacing.sm },
  title: { fontSize: FontSize.body + 1, fontWeight: '700', color: Colors.navy },
  text: { marginTop: 2, fontSize: FontSize.caption + 1, color: Colors.textMuted, lineHeight: 17 },
  button: { backgroundColor: Colors.orange, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  buttonText: { fontSize: FontSize.body, fontWeight: '700', color: Colors.white },
  close: { marginLeft: Spacing.xs, padding: Spacing.xs },
});
