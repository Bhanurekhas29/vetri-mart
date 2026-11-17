// "Delivery to <pincode>": asks the server whether we deliver there and how long it takes.
// It uses the pincode already chosen on Home; changing it here changes it everywhere.
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { usePincode } from '@/lib/pincode';
import type { DeliveryCheck as DeliveryCheckData } from '@/lib/types';

export function DeliveryCheck() {
  const { pincode, setPincode } = usePincode();
  const [draft, setDraft] = useState<string | null>(null); // what is being typed; null = show the saved pincode
  const [error, setError] = useState('');
  const text = draft ?? pincode ?? '';

  const valid = !!pincode && /^\d{6}$/.test(pincode);
  const { data, isLoading, isError, error: loadError } = useQuery({
    queryKey: ['delivery', pincode],
    enabled: valid,
    queryFn: async () => (await api.get<DeliveryCheckData>('delivery/check/', { params: { pincode } })).data,
  });

  async function check() {
    if (!/^\d{6}$/.test(text)) {
      setError('Enter a 6-digit pincode.');
      return;
    }
    setError('');
    await setPincode(text);
    setDraft(null);
  }

  return (
    <View style={styles.box}>
      <View style={styles.titleRow}>
        <Ionicons name="location-outline" size={18} color={Colors.navy} />
        <Text style={styles.title}>Delivery</Text>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={(value) => {
            setDraft(value.replace(/\D/g, '').slice(0, 6));
            setError('');
          }}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="Enter pincode"
          placeholderTextColor={Colors.textMuted}
          style={[styles.input, !!error && styles.inputError]}
          onSubmitEditing={check}
          accessibilityLabel="Delivery pincode"
        />
        <Pressable onPress={check} accessibilityRole="button" style={styles.checkButton}>
          <Text style={styles.checkText}>Check</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {valid && isLoading && <Text style={styles.muted}>Checking…</Text>}
      {valid && isError && <Text style={styles.error}>{getErrorMessage(loadError)}</Text>}
      {valid && data && (
        <View style={styles.result}>
          <Text style={[styles.message, data.deliverable ? styles.good : styles.bad]}>{data.message}</Text>
          {data.deliverable && (
            <Text style={styles.muted}>
              Delivery fee {formatRupees(data.delivery_fee)}. Free on orders above {formatRupees(data.free_delivery_above)}.
            </Text>
          )}
        </View>
      )}
      {!valid && !isLoading && <Text style={styles.muted}>Enter your pincode to see the delivery time.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text, marginLeft: Spacing.sm },
  inputRow: { flexDirection: 'row', marginTop: Spacing.sm },
  input: {
    flex: 1,
    fontSize: FontSize.title - 2,
    letterSpacing: 2,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  inputError: { borderColor: Colors.error },
  checkButton: { marginLeft: Spacing.sm, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  checkText: { color: Colors.navy, fontSize: FontSize.title - 2, fontWeight: '700' },
  result: { marginTop: Spacing.sm },
  message: { fontSize: FontSize.title - 2, fontWeight: '600' },
  good: { color: Colors.success },
  bad: { color: Colors.error },
  muted: { fontSize: FontSize.caption + 1, color: Colors.textMuted, marginTop: Spacing.xs },
  error: { fontSize: FontSize.caption + 1, color: Colors.error, marginTop: Spacing.xs },
});
