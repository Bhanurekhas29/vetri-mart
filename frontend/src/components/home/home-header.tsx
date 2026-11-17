// The navy top of the Home page: wordmark, bell, cart and the search box.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/lib/cart';
import { useUnreadCount } from '@/lib/notifications';

type IconButtonProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  count?: number;
  onPress: () => void;
};

function IconButton({ icon, label, count = 0, onPress }: IconButtonProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={count > 0 ? `${label}, ${count}` : label} hitSlop={8} style={styles.iconButton}>
      <Ionicons name={icon} size={24} color={Colors.white} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function HomeHeader() {
  const insets = useSafeAreaInsets();
  const { count } = useCart();
  const unread = useUnreadCount();

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.topRow}>
        <Text style={styles.wordmark} accessibilityRole="header">
          Vetri<Text style={styles.wordmarkAccent}>Mart</Text>
        </Text>
        <View style={styles.icons}>
          <IconButton icon="notifications-outline" label="Notifications" count={unread} onPress={() => router.push('/notifications')} />
          <IconButton icon="cart-outline" label="Cart" count={count} onPress={() => router.push('/cart')} />
        </View>
      </View>

      <Pressable
        onPress={() => router.push('/search')}
        accessibilityRole="search"
        accessibilityLabel="Search products"
        style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <Text style={styles.searchText}>Search products</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.navy, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  wordmark: { fontSize: 22, fontWeight: '700', color: Colors.white },
  wordmarkAccent: { color: Colors.orange },
  icons: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { marginLeft: Spacing.md, padding: 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  searchText: { marginLeft: Spacing.sm, fontSize: FontSize.body + 1, color: Colors.textMuted },
});
