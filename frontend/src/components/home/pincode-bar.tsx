// "Deliver to 600001" under the header. Tap it to change the pincode.
// The first time (no saved pincode and no default address) the question opens by itself, once.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { usePincode } from '@/lib/pincode';

export function PincodeBar() {
  const { status } = useAuth();
  const { pincode, ready, askedBefore, setPincode, markAsked } = usePincode();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  // Ask once: when there is no pincode at all and the user has never been asked.
  // (A logged-in user's default address counts as a pincode, so they are not asked.)
  const shouldAsk = ready && status !== 'loading' && !pincode && !askedBefore;

  const openChange = () => {
    setDraft(pincode ?? '');
    setError('');
    setOpen(true);
  };

  const close = async () => {
    setOpen(false);
    await markAsked(); // closing without saving counts as "asked", so we do not nag
  };

  const save = async () => {
    if (!/^\d{6}$/.test(draft)) {
      setError('Enter a 6-digit pincode.');
      return;
    }
    await setPincode(draft);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={openChange}
        accessibilityRole="button"
        accessibilityLabel={pincode ? `Deliver to ${pincode}. Tap to change` : 'Add your delivery pincode'}
        style={styles.bar}>
        <Ionicons name="location-outline" size={16} color={Colors.navy} />
        <Text style={styles.text} numberOfLines={1}>
          {pincode ? (
            <>
              Deliver to <Text style={styles.pincode}>{pincode}</Text>
            </>
          ) : (
            'Add your delivery pincode'
          )}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.navy} />
      </Pressable>

      <Modal visible={open || shouldAsk} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Delivery pincode</Text>
            <Text style={styles.subtitle}>We use it to show delivery times for your area.</Text>
            <TextInput
              value={draft}
              onChangeText={(text) => {
                setDraft(text.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="6-digit pincode"
              placeholderTextColor={Colors.textMuted}
              autoFocus
              style={[styles.input, !!error && styles.inputError]}
              onSubmitEditing={save}
              accessibilityLabel="Delivery pincode"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Save" onPress={save} style={styles.save} />
            <Button title="Not now" variant="link" onPress={close} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navySoft,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  text: { flex: 1, marginHorizontal: Spacing.sm, fontSize: FontSize.body, color: Colors.navy },
  pincode: { fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg },
  title: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text },
  subtitle: { fontSize: FontSize.body, color: Colors.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.md },
  input: {
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2,
  },
  inputError: { borderColor: Colors.error },
  error: { fontSize: FontSize.caption, color: Colors.error, marginTop: Spacing.xs },
  save: { marginTop: Spacing.md },
});
