// The coupon row of the cart. No coupon: "Apply coupon" opens a small box to type a code. With a coupon: what it saves
// (or, when it no longer applies, why), and Remove. Guests are asked to log in first (coupons belong to an account).
// One coupon at a time: a new code replaces the old one.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import type { CartCouponInfo } from '@/lib/types';

type Props = {
  signedIn: boolean;
  coupon: CartCouponInfo;
  apply: (code: string) => Promise<void>;
  remove: () => Promise<void>;
};

export function CouponBox({ signedIn, coupon, apply, remove }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = code.trim();
    if (!value) {
      setError('Enter a coupon code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apply(value);
      setOpen(false);
      setCode('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function takeOff() {
    setBusy(true);
    try {
      await remove();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function openBox() {
    if (!signedIn) {
      router.push('/login');
      return;
    }
    setError('');
    setOpen(true);
  }

  return (
    <View style={styles.wrap}>
      {coupon ? (
        <View style={styles.row}>
          <Ionicons name={coupon.valid ? 'pricetag' : 'alert-circle-outline'} size={22} color={coupon.valid ? Colors.success : Colors.error} />
          <View style={styles.body}>
            <Text style={styles.code}>{coupon.code}</Text>
            <Text style={[styles.note, !coupon.valid && styles.bad]} accessibilityLiveRegion="polite">
              {coupon.valid ? `You save ${formatRupees(coupon.discount)} with this coupon` : coupon.message}
            </Text>
          </View>
          <Pressable onPress={takeOff} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove coupon ${coupon.code}`}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={openBox} accessibilityRole="button" accessibilityLabel={signedIn ? 'Apply coupon' : 'Log in to use a coupon'} style={styles.row}>
          <Ionicons name="pricetag-outline" size={22} color={Colors.navy} />
          <Text style={styles.apply}>{signedIn ? 'Apply coupon' : 'Log in to use a coupon'}</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
      )}
      {coupon && !open && error ? <Text style={styles.errorLine}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title} accessibilityRole="header">
              Apply coupon
            </Text>
            <Text style={styles.subtitle}>One coupon works on an order. A new code replaces the old one.</Text>
            <TextInput
              value={code}
              onChangeText={(t) => {
                setCode(t.toUpperCase().replace(/\s/g, '').slice(0, 30));
                setError('');
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Enter coupon code"
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, !!error && styles.inputError]}
              onSubmitEditing={submit}
              autoFocus
              accessibilityLabel="Coupon code"
            />
            {error ? <Text style={styles.errorLine}>{error}</Text> : null}
            <Button title="Apply" onPress={submit} loading={busy} style={styles.applyButton} />
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: Colors.white, marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  body: { flex: 1, marginHorizontal: Spacing.md },
  code: { fontSize: FontSize.body + 1, fontWeight: '700', color: Colors.text },
  note: { marginTop: 2, fontSize: FontSize.caption + 1, color: Colors.success, fontWeight: '600' },
  bad: { color: Colors.error },
  apply: { flex: 1, marginLeft: Spacing.md, fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.navy },
  remove: { fontSize: FontSize.body, fontWeight: '700', color: Colors.error },
  errorLine: { marginTop: Spacing.xs, fontSize: FontSize.caption + 1, color: Colors.error },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg },
  title: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text },
  subtitle: { fontSize: FontSize.body, color: Colors.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.md },
  input: { fontSize: FontSize.title, letterSpacing: 2, color: Colors.text, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  inputError: { borderColor: Colors.error },
  applyButton: { marginTop: Spacing.md },
  cancel: { alignItems: 'center', paddingTop: Spacing.md },
  cancelText: { fontSize: FontSize.body, color: Colors.navy, fontWeight: '500' },
});
