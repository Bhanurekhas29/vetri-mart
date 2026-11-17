// Search and cart icons for the navy top bar of list screens. The cart shows how many items it holds.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useCart } from '@/lib/cart';

export function HeaderActions() {
  const { count } = useCart();
  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.push('/search')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Search" style={styles.icon}>
        <Ionicons name="search-outline" size={22} color={Colors.white} />
      </Pressable>
      <Pressable
        onPress={() => router.push('/cart')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={count > 0 ? `Open cart, ${count} items` : 'Open cart'}
        style={[styles.icon, styles.cart]}>
        <Ionicons name="cart-outline" size={24} color={Colors.white} />
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginLeft: Spacing.md },
  // room inside the button for the badge: the top bar cuts off anything that sticks out
  cart: { paddingTop: 8, paddingRight: 10 },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
});
