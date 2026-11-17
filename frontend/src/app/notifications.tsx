// The Notifications screen: order and payment updates, newest first, with an unread dot and "Mark all read".
// They are written by the server when an order or payment changes. Tapping one marks it read; order updates then
// open that order (or the Orders tab when the notification is not tied to one order).
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useNotifications } from '@/lib/notifications';
import type { AppNotification } from '@/lib/types';

export default function NotificationsScreen() {
  const { signedIn, items, unread, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, markRead, markAllRead } = useNotifications();

  const headerRight =
    signedIn && unread > 0
      ? () => (
          <Pressable onPress={() => markAllRead().catch((e) => Alert.alert('Notifications', getErrorMessage(e)))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Mark all as read">
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        )
      : undefined;
  const header = <Stack.Screen options={{ title: 'Notifications', headerRight }} />;

  async function open(n: AppNotification) {
    try {
      await markRead(n);
    } catch {
      // a failed "mark read" must not stop the shopper from going on
    }
    if (n.order_id) router.push(`/order/${n.order_id}`);
    else if (n.kind === 'order' || n.kind === 'payment') router.navigate('/(tabs)/orders');
  }

  if (!signedIn) {
    return (
      <View style={styles.center}>
        {header}
        <Ionicons name="notifications-outline" size={56} color={Colors.textMuted} />
        <Text style={styles.title}>Log in to see notifications</Text>
        <Text style={styles.note}>We tell you here when your order is confirmed, shipped or delivered.</Text>
        <Button title="Log in" onPress={() => router.push('/login')} style={styles.cta} />
      </View>
    );
  }
  if (isLoading) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.center}>
        {header}
        <Text style={styles.note}>{getErrorMessage(error)}</Text>
        <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.cta} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <FlatList
        data={items}
        keyExtractor={(n) => String(n.id)}
        refreshing={false}
        onRefresh={() => refetch()}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={items.length === 0 ? styles.emptyWrap : undefined}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="notifications-outline" size={56} color={Colors.textMuted} />
            <Text style={styles.title}>No notifications yet</Text>
            <Text style={styles.note}>Order and payment updates will show up here.</Text>
          </View>
        }
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={Colors.navy} style={styles.footer} /> : undefined}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.is_read ? '' : 'Unread. '}${item.title}. ${item.message}. ${timeAgo(item.created_at)}`}
            style={[styles.row, !item.is_read && styles.rowUnread]}>
            <View style={[styles.icon, item.kind === 'payment' && styles.iconPayment]}>
              <Ionicons name={item.kind === 'payment' ? 'card-outline' : 'cube-outline'} size={20} color={Colors.navy} />
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={[styles.rowTitle, !item.is_read && styles.bold]} numberOfLines={1}>
                  {item.title}
                </Text>
                {!item.is_read && <View style={styles.dot} />}
              </View>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  emptyWrap: { flexGrow: 1 },
  title: { fontSize: FontSize.heading, fontWeight: '600', color: Colors.text, marginTop: Spacing.md, textAlign: 'center' },
  note: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  cta: { marginTop: Spacing.lg, alignSelf: 'stretch' },
  markAll: { color: Colors.white, fontSize: FontSize.body, fontWeight: '600' },
  row: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowUnread: { backgroundColor: Colors.navySoft },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  iconPayment: { borderColor: Colors.navy },
  body: { flex: 1, marginLeft: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { flex: 1, fontSize: FontSize.body + 1, color: Colors.text },
  bold: { fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.orange, marginLeft: Spacing.sm },
  message: { marginTop: 2, fontSize: FontSize.body, color: Colors.text, lineHeight: 20 },
  time: { marginTop: 4, fontSize: FontSize.caption + 1, color: Colors.textMuted },
  footer: { marginVertical: Spacing.md },
});
