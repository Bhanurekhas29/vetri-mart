// A labelled text box with an error line. Add `secure` for a password box with a show/hide eye.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  secure?: boolean;
};

export function TextField({ label, error, hint, secure = false, style, ...inputProps }: Props) {
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, !!error && styles.boxError]}>
        <TextInput
          {...inputProps}
          style={[styles.input, style]}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={secure && hidden}
          autoCapitalize={secure ? 'none' : inputProps.autoCapitalize}
        />
        {secure && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={8}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.body, color: Colors.text, marginBottom: Spacing.xs, fontWeight: '500' },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  boxError: { borderColor: Colors.error },
  input: { flex: 1, fontSize: FontSize.title - 2, color: Colors.text, paddingVertical: Spacing.sm },
  error: { fontSize: FontSize.caption, color: Colors.error, marginTop: Spacing.xs },
  hint: { fontSize: FontSize.caption, color: Colors.textMuted, marginTop: Spacing.xs },
});
