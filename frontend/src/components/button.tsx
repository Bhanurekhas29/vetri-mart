// The app's button. Orange primary for the main action, navy outline for the second choice.
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'link' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style }: Props) {
  const inactive = disabled || loading;
  const textColor =
    variant === 'primary' ? Colors.white : variant === 'danger' ? Colors.error : Colors.navy;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        variant === 'link' && styles.link,
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }, variant === 'link' && styles.linkText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  primary: { backgroundColor: Colors.orange },
  secondary: { borderWidth: 1.5, borderColor: Colors.navy, backgroundColor: Colors.white },
  danger: { borderWidth: 1.5, borderColor: Colors.error, backgroundColor: Colors.white },
  link: { minHeight: 40 },
  inactive: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  text: { fontSize: FontSize.title - 2, fontWeight: '600' },
  linkText: { fontSize: FontSize.body, fontWeight: '500' },
});
