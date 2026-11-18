// The coupon row of the cart. No coupon: "Apply coupon" opens a box where the shopper can type a code AND see the offers
// the shop has switched on ("Available offers"), each with its own Apply button. With a coupon: what it saves (or, when it
// no longer applies, why), and Remove. Guests can see the offers too, but are asked to log in to use one (coupons belong
// to an account). One coupon at a time: a new code replaces the old one.
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import type { CartCouponInfo, CouponOffer } from '@/lib/types';

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

  // The offers are looked at again every time the box opens, so they are never out of date.
  const offersQuery = useQuery({
    queryKey: ['offers', signedIn, coupon?.code ?? ''],
    enabled: open,
    staleTime: 0,
    queryFn: async () => (await api.get<{ offers: CouponOffer[] }>('coupons/available/')).data.offers,
  });

  async function submit(value = code.trim()) {
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
    setError('');
    setOpen(true);
  }

  function logIn() {
    setOpen(false);
    router.push('/login');
  }

  const offers = offersQuery.data ?? [];

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
        <Pressable onPress={openBox} accessibilityRole="button" accessibilityLabel="Apply coupon or see available offers" style={styles.row}>
          <Ionicons name="pricetag-outline" size={22} color={Colors.navy} />
          <Text style={styles.apply}>Apply coupon</Text>
          <Text style={styles.seeOffers}>See offers</Text>
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

            {signedIn ? (
              <>
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
                  onSubmitEditing={() => submit()}
                  accessibilityLabel="Coupon code"
                />
                {error ? <Text style={styles.errorLine}>{error}</Text> : null}
                <Button title="Apply" onPress={() => submit()} loading={busy} style={styles.applyButton} />
              </>
            ) : (
              <Button title="Log in to use a coupon" onPress={logIn} style={styles.applyButton} />
            )}

            <Text style={styles.offersTitle} accessibilityRole="header">
              Available offers
            </Text>
            {offersQuery.isLoading ? (
              <ActivityIndicator color={Colors.navy} style={styles.loading} />
            ) : offersQuery.isError ? (
              <Text style={styles.offerNote}>Could not load the offers. You can still type a code.</Text>
            ) : offers.length === 0 ? (
              <Text style={styles.offerNote}>There are no offers right now. Check back soon!</Text>
            ) : (
              <ScrollView style={styles.offerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {offers.map((o) => {
                  const can = signedIn && o.eligible === true && !o.applied;
                  return (
                    <View key={o.code} style={styles.offer}>
                      <View style={styles.offerBody}>
                        <Text style={styles.offerCode}>{o.code}</Text>
                        <Text style={styles.offerTitle}>{o.title}</Text>
                        {o.title !== o.detail ? <Text style={styles.offerDetail}>{o.detail}</Text> : null}
                        {o.applied ? (
                          <Text style={styles.offerGood}>Applied</Text>
                        ) : !signedIn ? (
                          <Text style={styles.offerDetail}>Log in to use this offer</Text>
                        ) : o.eligible ? (
                          <Text style={styles.offerGood}>You save {formatRupees(o.discount ?? '0')} on this cart</Text>
                        ) : (
                          <Text style={styles.offerBad}>{o.reason}</Text>
                        )}
                      </View>
                      {o.applied ? (
                        <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                      ) : (
                        <Pressable
                          onPress={() => (signedIn ? submit(o.code) : logIn())}
                          disabled={busy || (signedIn && !can)}
                          accessibilityRole="button"
                          accessibilityLabel={signedIn ? `Apply ${o.code}` : 'Log in to use this offer'}
                          style={[styles.pill, signedIn && !can && styles.pillOff]}>
                          <Text style={styles.pillText}>{signedIn ? 'Apply' : 'Log in'}</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={styles.cancel}>
              <Text style={styles.cancelText}>Close</Text>
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
  seeOffers: { fontSize: FontSize.caption + 1, fontWeight: '600', color: Colors.textMuted, marginRight: Spacing.xs },
  remove: { fontSize: FontSize.body, fontWeight: '700', color: Colors.error },
  errorLine: { marginTop: Spacing.xs, fontSize: FontSize.caption + 1, color: Colors.error },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, maxHeight: '90%' },
  title: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text },
  subtitle: { fontSize: FontSize.body, color: Colors.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.md },
  input: { fontSize: FontSize.title, letterSpacing: 2, color: Colors.text, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  inputError: { borderColor: Colors.error },
  applyButton: { marginTop: Spacing.md },
  offersTitle: { fontSize: FontSize.body + 1, fontWeight: '700', color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  loading: { marginVertical: Spacing.md },
  offerNote: { fontSize: FontSize.body, color: Colors.textMuted, marginTop: Spacing.xs },
  offerList: { flexGrow: 0, maxHeight: 280 },
  offer: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm + 2, borderTopWidth: 1, borderTopColor: Colors.border },
  offerBody: { flex: 1, marginRight: Spacing.md },
  offerCode: { alignSelf: 'flex-start', fontSize: FontSize.caption + 1, fontWeight: '700', color: Colors.navy, backgroundColor: Colors.navySoft, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2, overflow: 'hidden' },
  offerTitle: { marginTop: Spacing.xs, fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  offerDetail: { marginTop: 2, fontSize: FontSize.caption + 1, color: Colors.textMuted },
  offerGood: { marginTop: 2, fontSize: FontSize.caption + 1, fontWeight: '600', color: Colors.success },
  offerBad: { marginTop: 2, fontSize: FontSize.caption + 1, color: Colors.textMuted },
  pill: { backgroundColor: Colors.orange, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  pillOff: { backgroundColor: Colors.border },
  pillText: { fontSize: FontSize.body, fontWeight: '700', color: Colors.white },
  cancel: { alignItems: 'center', paddingTop: Spacing.md },
  cancelText: { fontSize: FontSize.body, color: Colors.navy, fontWeight: '500' },
});
