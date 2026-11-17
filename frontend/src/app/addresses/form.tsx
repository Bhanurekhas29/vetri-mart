// Add a new address, or edit one when an `id` is passed.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FormError, FormScreen } from '@/components/form-screen';
import { TextField } from '@/components/text-field';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage, getFieldErrors } from '@/lib/api';
import type { Address, AddressLabel } from '@/lib/types';

const LABEL_CHOICES: { value: AddressLabel; text: string }[] = [
  { value: 'home', text: 'Home' },
  { value: 'work', text: 'Work' },
  { value: 'other', text: 'Other' },
];

type FormState = {
  recipient_name: string;
  phone: string;
  pincode: string;
  address_line1: string;
  address_line2: string;
  landmark: string;
  city: string;
  state: string;
  label: AddressLabel;
  is_default: boolean;
};

const EMPTY: FormState = {
  recipient_name: '',
  phone: '',
  pincode: '',
  address_line1: '',
  address_line2: '',
  landmark: '',
  city: '',
  state: '',
  label: 'home',
  is_default: false,
};

const REQUIRED: { key: keyof FormState; message: string }[] = [
  { key: 'recipient_name', message: 'Enter the recipient name.' },
  { key: 'address_line1', message: 'Enter the address.' },
  { key: 'city', message: 'Enter the city.' },
  { key: 'state', message: 'Enter the state.' },
];

// The screen loads the saved address first (when editing), then shows the form already filled in.
export default function AddressFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading } = useQuery({
    queryKey: ['address', id],
    queryFn: async () => (await api.get<Address>(`addresses/${id}/`)).data,
    enabled: isEdit,
  });

  if (isEdit && (isLoading || !existing)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }

  return <AddressForm id={id} initial={existing ? toFormState(existing) : EMPTY} />;
}

function toFormState(address: Address): FormState {
  return {
    recipient_name: address.recipient_name,
    phone: address.phone,
    pincode: address.pincode,
    address_line1: address.address_line1,
    address_line2: address.address_line2,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    label: address.label,
    is_default: address.is_default,
  };
}

function AddressForm({ id, initial }: { id?: string; initial: FormState }) {
  const isEdit = !!id;
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setError('');
    const errors: Record<string, string> = {};
    for (const { key, message } of REQUIRED) {
      if (!String(form[key]).trim()) errors[key] = message;
    }
    if (!/^[6-9]\d{9}$/.test(form.phone)) errors.phone = 'Enter a valid 10-digit mobile number.';
    if (!/^\d{6}$/.test(form.pincode)) errors.pincode = 'Enter a 6-digit pincode.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      if (isEdit) await api.patch(`addresses/${id}/`, form);
      else await api.post('addresses/', form);
      await queryClient.invalidateQueries({ queryKey: ['addresses'] });
      await queryClient.invalidateQueries({ queryKey: ['address', id] });
      router.back();
    } catch (e) {
      setFieldErrors(getFieldErrors(e));
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScreen title={isEdit ? 'Edit address' : 'New address'}>
      <TextField
        label="Recipient name"
        value={form.recipient_name}
        onChangeText={(v) => set('recipient_name', v)}
        autoCapitalize="words"
        hint="Sending a gift? Use the name of the person who will receive it."
        error={fieldErrors.recipient_name}
      />
      <TextField
        label="Mobile number"
        value={form.phone}
        onChangeText={(v) => set('phone', v.replace(/\D/g, '').slice(0, 10))}
        keyboardType="number-pad"
        placeholder="10-digit number"
        hint="The courier will call this number."
        error={fieldErrors.phone}
      />
      <TextField
        label="Pincode"
        value={form.pincode}
        onChangeText={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        placeholder="6 digits"
        error={fieldErrors.pincode}
      />
      <TextField
        label="Address line 1"
        value={form.address_line1}
        onChangeText={(v) => set('address_line1', v)}
        placeholder="House number, street"
        error={fieldErrors.address_line1}
      />
      <TextField
        label="Address line 2 (optional)"
        value={form.address_line2}
        onChangeText={(v) => set('address_line2', v)}
        placeholder="Area, locality"
        error={fieldErrors.address_line2}
      />
      <TextField
        label="Landmark (optional)"
        value={form.landmark}
        onChangeText={(v) => set('landmark', v)}
        error={fieldErrors.landmark}
      />
      <TextField label="City" value={form.city} onChangeText={(v) => set('city', v)} error={fieldErrors.city} />
      <TextField label="State" value={form.state} onChangeText={(v) => set('state', v)} error={fieldErrors.state} />

      <Text style={styles.sectionLabel}>Address type</Text>
      <View style={styles.chips}>
        {LABEL_CHOICES.map((choice) => (
          <Pressable
            key={choice.value}
            onPress={() => set('label', choice.value)}
            style={[styles.chip, form.label === choice.value && styles.chipActive]}>
            <Text style={[styles.chipText, form.label === choice.value && styles.chipTextActive]}>{choice.text}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Make this my default address</Text>
        <Switch value={form.is_default} onValueChange={(v) => set('is_default', v)} trackColor={{ true: Colors.orange }} />
      </View>

      <FormError message={Object.keys(fieldErrors).length > 0 ? undefined : error} />
      <Button title="Save address" onPress={save} loading={saving} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  sectionLabel: { fontSize: FontSize.body, fontWeight: '500', color: Colors.text, marginBottom: Spacing.sm },
  chips: { flexDirection: 'row', marginBottom: Spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
  },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: FontSize.body, color: Colors.text },
  chipTextActive: { color: Colors.white },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  switchLabel: { fontSize: FontSize.body, color: Colors.text },
});
