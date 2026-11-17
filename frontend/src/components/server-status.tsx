// Asks the backend "are you there?" and shows the answer. A slice 0 check only.
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';

export function ServerStatus() {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get<{ status: string }>('health/')).data,
  });

  let label = 'Checking server...';
  let color: string = Colors.textMuted;
  if (!isLoading && data?.status === 'ok') {
    label = 'Server connected';
    color = Colors.success;
  } else if (isError) {
    label = getErrorMessage(error);
    color = Colors.error;
  }

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.sm },
  text: { fontSize: FontSize.body },
});
