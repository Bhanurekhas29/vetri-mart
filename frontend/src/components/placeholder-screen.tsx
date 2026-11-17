// A simple empty screen. Each tab uses it until its real content is built in a later slice.
import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Spacing } from '@/constants/theme';

type Props = {
  title: string;
  note: string;
  children?: React.ReactNode;
};

export function PlaceholderScreen({ title, note, children }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  note: {
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
