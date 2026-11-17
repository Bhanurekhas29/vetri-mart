// The wishlist heart. Filled red = saved. Guests who tap it are asked to log in first.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { getErrorMessage } from '@/lib/api';
import { useWishlist } from '@/lib/wishlist';

type Props = {
  product: { id: number; slug: string; name: string };
  size?: number;
  // 'card' = a small white circle on a product picture, 'header' = a plain white icon on the navy top bar
  tone?: 'card' | 'header';
  style?: StyleProp<ViewStyle>;
};

export function HeartButton({ product, size = 18, tone = 'card', style }: Props) {
  const { isSaved, toggle } = useWishlist();
  const [busy, setBusy] = useState(false);
  const saved = isSaved(product.id);

  async function onPress() {
    if (busy) return;
    setBusy(true);
    try {
      await toggle(product);
    } catch (e) {
      Alert.alert('Wishlist', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const color = saved ? Colors.error : tone === 'header' ? Colors.white : Colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      accessibilityState={{ selected: saved, busy }}
      style={[tone === 'card' && styles.circle, busy && styles.busy, style]}>
      <Ionicons name={saved ? 'heart' : 'heart-outline'} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { opacity: 0.5 },
});
