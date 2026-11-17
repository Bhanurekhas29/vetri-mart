// A scrolling page for forms. It keeps the keyboard from covering the inputs.
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { Colors, FontSize, Spacing } from '@/constants/theme';

type Props = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function FormScreen({ title, subtitle, children }: Props) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// A red message line for errors that are not tied to one input.
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  title: { fontSize: FontSize.heading, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.body, color: Colors.textMuted, marginBottom: Spacing.lg },
  error: { fontSize: FontSize.body, color: Colors.error, marginBottom: Spacing.md },
});
