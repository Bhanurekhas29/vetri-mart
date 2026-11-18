// Checkout, step 1: choose where it goes, check the price, then pay.
// The server works out everything (delivery check, totals, whether payment is set up). Tapping Pay creates the order as
// "Pending payment" and opens Razorpay's payment page; the order is only confirmed after the payment is verified.
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Picture } from '@/components/picture';
import { StepIndicator } from '@/components/step-indicator';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatRupees } from '@/lib/format';
import { usePincode } from '@/lib/pincode';
import type { PlaceOrderResult } from '@/lib/razorpay';
import type { Address, CheckoutSummary } from '@/lib/types';

function addressLines(a: { recipient_name: string; phone: string; address_line1: string; address_line2: string; landmark: string; city: string; state: string; pincode: string }) {
  return [a.address_line1, a.address_line2, a.landmark, `${a.city}, ${a.state} ${a.pincode}`].filter(Boolean).join(', ');
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const [addressId, setAddressId] = useState<number | null>(null); // null = the default address
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [userPicked, setUserPicked] = useState(false); // true once the shopper chose an address by hand: then we never switch it for them
  const { pincode: homePin, setPincode } = usePincode(); // the delivery pincode chosen on Home

  const summaryQuery = useQuery({
    queryKey: ['checkout', addressId],
    enabled: status === 'signedIn',
    queryFn: async () => (await api.get<CheckoutSummary>('checkout/summary/', { params: addressId ? { address_id: addressId } : {} })).data,
  });
  const addressesQuery = useQuery({
    queryKey: ['addresses'],
    enabled: status === 'signedIn',
    queryFn: async () => (await api.get<Address[]>('addresses/')).data,
  });

  // If the shopper has a saved address in the pincode chosen on Home, and the selected address is in another one,
  // switch to the matching address (unless they picked an address by hand).
  const summaryLoaded = !!summaryQuery.data;
  const currentPin = summaryQuery.data?.address?.pincode;
  const savedAddresses = addressesQuery.data;
  useEffect(() => {
    if (userPicked || !homePin || !savedAddresses || !summaryLoaded || currentPin === homePin) return;
    const match = savedAddresses.find((a) => a.pincode === homePin);
    if (match && match.id !== addressId) setAddressId(match.id);
  }, [userPicked, homePin, savedAddresses, summaryLoaded, currentPin, addressId]);

  // coming back from the cart or from adding an address: look again
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['checkout'] });
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    }, [queryClient]),
  );

  const header = <Stack.Screen options={{ title: 'Checkout' }} />;

  if (status !== 'signedIn') {
    return (
      <View style={styles.center}>
        {header}
        <Ionicons name="lock-closed-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.title}>Log in to check out</Text>
        <Button title="Log in" onPress={() => router.push('/login')} style={styles.cta} />
      </View>
    );
  }
  if (summaryQuery.isLoading) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }
  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <View style={styles.center}>
        {header}
        <Text style={styles.note}>{getErrorMessage(summaryQuery.error)}</Text>
        <Button title="Try again" variant="secondary" onPress={() => summaryQuery.refetch()} style={styles.cta} />
      </View>
    );
  }

  const data = summaryQuery.data;
  const { summary, address, delivery } = data;
  const freeDelivery = Number(summary.delivery_fee) === 0;
  const shown = data.items.slice(0, 4);
  // The pincode on Home and the pincode of the chosen address are different: say so, so the order goes to the right place.
  const mismatch = !!homePin && !!address && address.pincode !== homePin;

  function addAddressForHomePincode() {
    setUserPicked(false); // after saving, the new address (same pincode as Home) is picked automatically
    router.push({ pathname: '/addresses/form', params: homePin ? { pincode: homePin } : {} });
  }

  async function pay() {
    if (!address || paying) return;
    setPaying(true);
    try {
      const { data: placed } = await api.post<PlaceOrderResult>('orders/', { address_id: address.id });
      // the order now exists: the payment page takes over
      router.push({ pathname: '/payment', params: { placed: JSON.stringify(placed) } });
    } catch (e) {
      Alert.alert('Could not place the order', getErrorMessage(e));
      summaryQuery.refetch();
    } finally {
      setPaying(false);
    }
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}>
        <StepIndicator current={0} />

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              Deliver to
            </Text>
            <Pressable onPress={() => setPickerOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={address ? 'Change delivery address' : 'Add a delivery address'}>
              <Text style={styles.link}>{address ? 'Change' : 'Add address'}</Text>
            </Pressable>
          </View>
          {address ? (
            <>
              <Text style={styles.addressName}>
                {address.recipient_name} <Text style={styles.addressTag}>{address.label.toUpperCase()}</Text>
              </Text>
              <Text style={styles.addressText}>{addressLines(address)}</Text>
              <Text style={styles.addressText}>Phone: {address.phone}</Text>
              {delivery && <Text style={[styles.delivery, delivery.deliverable ? styles.good : styles.bad]}>{delivery.message}</Text>}
              {mismatch && (
                <View style={styles.mismatch} accessibilityRole="alert">
                  <Text style={styles.mismatchText}>
                    The delivery pincode on Home is <Text style={styles.mismatchBold}>{homePin}</Text>, but this address is in <Text style={styles.mismatchBold}>{address.pincode}</Text>. Please check, so your order goes to the right place.
                  </Text>
                  <Button title={`Add address for ${homePin}`} onPress={addAddressForHomePincode} style={styles.mismatchButton} />
                  <Pressable onPress={() => setPincode(address.pincode)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Use ${address.pincode} as the delivery pincode instead`} style={styles.mismatchLinkWrap}>
                    <Text style={styles.link}>Use {address.pincode} instead</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.note}>You have no saved address yet. Add one to continue.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              Items ({summary.units})
            </Text>
            <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="View items in cart">
              <Text style={styles.link}>View</Text>
            </Pressable>
          </View>
          <View style={styles.thumbs}>
            {shown.map((item, i) => (
              <Picture key={i} uri={item.image} alt={item.image_alt || item.name} contentFit="contain" icon="cube-outline" style={styles.thumb} />
            ))}
            {data.items.length > shown.length && <Text style={styles.more}>+{data.items.length - shown.length} more</Text>}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Payment
          </Text>
          <View style={styles.payRow}>
            <Ionicons name="shield-checkmark-outline" size={22} color={Colors.success} />
            <Text style={styles.payText}>Pay securely with Razorpay: UPI, cards, net banking and wallets.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Price details
          </Text>
          <PriceRow label={`Price (${summary.units} ${summary.units === 1 ? 'item' : 'items'})`} value={formatRupees(summary.mrp_total)} />
          {Number(summary.discount) > 0 && <PriceRow label="Discount" value={`- ${formatRupees(summary.discount)}`} good />}
          {Number(summary.bundle_savings) > 0 && <PriceRow label="Bundle savings" value={`- ${formatRupees(summary.bundle_savings)}`} good />}
          {Number(summary.coupon_discount) > 0 && <PriceRow label={`Coupon ${summary.coupon_code}`} value={`- ${formatRupees(summary.coupon_discount)}`} good />}
          <PriceRow label="Delivery" value={freeDelivery ? 'Free' : formatRupees(summary.delivery_fee)} good={freeDelivery} />
          {data.coupon && !data.coupon.valid ? <Text style={styles.couponNote}>Coupon {data.coupon.code} is not applied: {data.coupon.message}</Text> : null}
          <View style={styles.divider} />
          <PriceRow label="Total to pay" value={formatRupees(summary.total)} bold />
          {Number(summary.you_save) > 0 && <Text style={styles.save}>You save {formatRupees(summary.you_save)} on this order</Text>}
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Spacing.sm + insets.bottom }]}>
        {data.blockers.map((b) => (
          <Text key={b} style={styles.blocker}>
            {b}
          </Text>
        ))}
        <Button title={`Pay ${formatRupees(summary.total)}`} onPress={pay} loading={paying} disabled={!data.can_pay} />
      </View>

      <AddressPicker
        visible={pickerOpen}
        addresses={addressesQuery.data ?? []}
        selectedId={address?.id ?? null}
        onPick={(id) => {
          setUserPicked(true);
          setAddressId(id);
          setPickerOpen(false);
        }}
        onAdd={() => {
          setPickerOpen(false);
          addAddressForHomePincode();
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

function PriceRow({ label, value, good, bold }: { label: string; value: string; good?: boolean; bold?: boolean }) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.priceValue, good && styles.goodBold, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

type PickerProps = { visible: boolean; addresses: Address[]; selectedId: number | null; onPick: (id: number) => void; onAdd: () => void; onClose: () => void };

function AddressPicker({ visible, addresses, selectedId, onPick, onAdd, onClose }: PickerProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Spacing.md + insets.bottom }]}>
        <Text style={styles.sheetTitle} accessibilityRole="header">
          Choose a delivery address
        </Text>
        <ScrollView style={styles.sheetList}>
          {addresses.map((a) => (
            <Pressable key={a.id} onPress={() => onPick(a.id)} accessibilityRole="radio" accessibilityState={{ selected: a.id === selectedId }} style={styles.pickRow}>
              <Ionicons name={a.id === selectedId ? 'radio-button-on' : 'radio-button-off'} size={22} color={Colors.navy} />
              <View style={styles.pickBody}>
                <Text style={styles.addressName}>
                  {a.recipient_name} <Text style={styles.addressTag}>{a.label.toUpperCase()}</Text>
                </Text>
                <Text style={styles.addressText}>{addressLines(a)}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
        <Button title="Add a new address" variant="secondary" onPress={onAdd} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  title: { fontSize: FontSize.heading, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
  note: { fontSize: FontSize.body, color: Colors.textMuted, marginTop: Spacing.sm },
  cta: { marginTop: Spacing.lg, alignSelf: 'stretch' },
  card: { backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text },
  link: { fontSize: FontSize.body + 1, fontWeight: '700', color: Colors.navy },
  addressName: { marginTop: Spacing.sm, fontSize: FontSize.body + 1, fontWeight: '700', color: Colors.text },
  addressTag: { fontSize: FontSize.caption, fontWeight: '700', color: Colors.textMuted },
  addressText: { marginTop: 2, fontSize: FontSize.body, color: Colors.text, lineHeight: 20 },
  delivery: { marginTop: Spacing.sm, fontSize: FontSize.body + 1, fontWeight: '600' },
  good: { color: Colors.success },
  bad: { color: Colors.error },
  mismatch: { backgroundColor: Colors.navySoft, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
  mismatchText: { fontSize: FontSize.body, color: Colors.text, lineHeight: 20 },
  mismatchBold: { fontWeight: '700' },
  mismatchButton: { marginTop: Spacing.md },
  mismatchLinkWrap: { alignSelf: 'center', marginTop: Spacing.md },
  thumbs: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  thumb: { width: 56, height: 56, borderRadius: Radius.md, marginRight: Spacing.sm },
  more: { fontSize: FontSize.body, color: Colors.textMuted },
  payRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  payText: { flex: 1, marginLeft: Spacing.sm, fontSize: FontSize.body, color: Colors.text },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  priceLabel: { fontSize: FontSize.body + 1, color: Colors.text },
  priceValue: { fontSize: FontSize.body + 1, color: Colors.text },
  goodBold: { color: Colors.success, fontWeight: '600' },
  bold: { fontSize: FontSize.title, fontWeight: '700' },
  couponNote: { marginTop: Spacing.sm, fontSize: FontSize.caption + 1, color: Colors.error },
  divider: { height: 1, backgroundColor: Colors.border, marginTop: Spacing.md },
  save: { marginTop: Spacing.md, fontSize: FontSize.body, color: Colors.success, fontWeight: '600' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  blocker: { fontSize: FontSize.caption + 1, color: Colors.error, marginBottom: Spacing.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '75%', backgroundColor: Colors.white, borderTopLeftRadius: Radius.lg + 4, borderTopRightRadius: Radius.lg + 4, padding: Spacing.md },
  sheetTitle: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  sheetList: { marginBottom: Spacing.md },
  pickRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.sm + 2, borderTopWidth: 1, borderTopColor: Colors.border },
  pickBody: { flex: 1, marginLeft: Spacing.md },
});
