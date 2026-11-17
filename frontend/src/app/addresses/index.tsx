// The address book: see, add, edit, delete and choose the default address.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import type { Address } from '@/lib/types';

const LABELS: Record<Address['label'], string> = { home: 'Home', work: 'Work', other: 'Other' };

export default function AddressesScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => (await api.get<Address[]>('addresses/')).data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['addresses'] });

  const makeDefault = useMutation({
    mutationFn: (id: number) => api.patch(`addresses/${id}/`, { is_default: true }),
    onSuccess: refresh,
    onError: (e) => Alert.alert('Could not update', getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`addresses/${id}/`),
    onSuccess: refresh,
    onError: (e) => Alert.alert('Could not delete', getErrorMessage(e)),
  });

  const confirmDelete = (address: Address) => {
    Alert.alert('Delete this address?', `${address.recipient_name}, ${address.city}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(address.id) },
    ]);
  };

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
        <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.retry} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={data}
        keyExtractor={(address) => String(address.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No saved addresses</Text>
            <Text style={styles.note}>Add an address to check out faster.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{item.recipient_name}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{LABELS[item.label]}</Text>
              </View>
              {item.is_default && (
                <View style={[styles.badge, styles.defaultBadge]}>
                  <Text style={[styles.badgeText, styles.defaultText]}>Default</Text>
                </View>
              )}
            </View>
            <Text style={styles.line}>
              {[item.address_line1, item.address_line2, item.landmark].filter(Boolean).join(', ')}
            </Text>
            <Text style={styles.line}>
              {item.city}, {item.state} {item.pincode}
            </Text>
            <Text style={styles.line}>Phone: {item.phone}</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => router.push({ pathname: '/addresses/form', params: { id: String(item.id) } })}>
                <Text style={styles.action}>Edit</Text>
              </Pressable>
              {!item.is_default && (
                <Pressable onPress={() => makeDefault.mutate(item.id)}>
                  <Text style={styles.action}>Make default</Text>
                </Pressable>
              )}
              <Pressable onPress={() => confirmDelete(item)}>
                <Text style={[styles.action, styles.delete]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
      <View style={styles.footer}>
        <Button title="Add new address" onPress={() => router.push('/addresses/form')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  list: { padding: Spacing.md, paddingBottom: Spacing.xl },
  empty: { alignItems: 'center', paddingTop: Spacing.xl * 2 },
  emptyTitle: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs },
  note: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center' },
  retry: { marginTop: Spacing.md, alignSelf: 'stretch' },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs, flexWrap: 'wrap' },
  name: { fontSize: FontSize.title - 2, fontWeight: '600', color: Colors.text, marginRight: Spacing.sm },
  badge: { backgroundColor: Colors.navySoft, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6 },
  badgeText: { fontSize: FontSize.caption, color: Colors.navy },
  defaultBadge: { backgroundColor: Colors.orange },
  defaultText: { color: Colors.white },
  line: { fontSize: FontSize.body, color: Colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', marginTop: Spacing.md },
  action: { fontSize: FontSize.body, color: Colors.navy, fontWeight: '600', marginRight: Spacing.lg },
  delete: { color: Colors.error },
  footer: { padding: Spacing.md, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
});
