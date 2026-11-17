// The Profile tab. Logged out: an invitation to log in.
// Logged in: the person (with a photo and an edit button), four shortcuts, the account list and Log out.
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function MenuItem({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={Colors.navy} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

function Shortcut({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.shortcutIcon}>
        <Ionicons name={icon} size={22} color={Colors.navy} />
      </View>
      <Text style={styles.shortcutLabel}>{label}</Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { status, user, signOut, refreshUser } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }

  if (status === 'signedOut') {
    return (
      <View style={styles.center}>
        <View style={styles.avatarLarge}>
          <Ionicons name="person-outline" size={36} color={Colors.navy} />
        </View>
        <Text style={styles.title}>Log in to Vetri Mart</Text>
        <Text style={styles.note}>Save your addresses, track orders and keep a wishlist.</Text>
        <Button title="Log in or sign up" onPress={() => router.push('/login')} style={styles.loginButton} />
        <Pressable onPress={() => router.push('/help')} accessibilityRole="button" style={styles.guestHelp}>
          <Ionicons name="help-circle-outline" size={18} color={Colors.navy} />
          <Text style={styles.guestHelpText}>Help</Text>
        </Pressable>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.note}>We could not load your profile.</Text>
        <Button title="Try again" variant="secondary" onPress={refreshUser} style={styles.loginButton} />
      </View>
    );
  }

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You will need to log in again to see your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Avatar photoUrl={user.photo_url} name={user.name} email={user.email} size={60} />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {user.name || 'Your name'}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/edit-profile')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Edit profile" style={styles.editButton}>
          <Ionicons name="create-outline" size={22} color={Colors.white} />
        </Pressable>
      </View>

      <View style={styles.shortcuts}>
        <Shortcut icon="cube-outline" label="Orders" onPress={() => router.navigate('/(tabs)/orders')} />
        <Shortcut icon="heart-outline" label="Wishlist" onPress={() => router.navigate('/(tabs)/wishlist')} />
        <Shortcut icon="location-outline" label="Addresses" onPress={() => router.push('/addresses')} />
        <Shortcut icon="help-circle-outline" label="Help" onPress={() => router.push('/help')} />
      </View>

      <View style={styles.menu}>
        <MenuItem icon="person-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
        <MenuItem icon="star-outline" label="My reviews" onPress={() => router.push('/my-reviews')} />
        <MenuItem icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications')} />
        <MenuItem icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        <MenuItem icon="information-circle-outline" label="About Vetri Mart" onPress={() => router.push('/page/about')} />
      </View>

      <Button title="Log out" variant="danger" onPress={confirmLogout} style={styles.logout} />
      <Text style={styles.version}>Vetri Mart version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.navySoft, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  title: { fontSize: FontSize.heading, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  note: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center' },
  loginButton: { marginTop: Spacing.lg, alignSelf: 'stretch' },
  guestHelp: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg },
  guestHelpText: { marginLeft: 6, fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.navy },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.navy, padding: Spacing.lg },
  headerText: { marginLeft: Spacing.md, flex: 1 },
  name: { color: Colors.white, fontSize: FontSize.title, fontWeight: '600' },
  email: { color: Colors.navySoft, fontSize: FontSize.body, marginTop: 2 },
  editButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  shortcuts: { flexDirection: 'row', backgroundColor: Colors.white, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  shortcut: { flex: 1, alignItems: 'center' },
  shortcutIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.navySoft, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { marginTop: Spacing.xs + 2, fontSize: FontSize.caption + 1, fontWeight: '600', color: Colors.text },
  menu: { backgroundColor: Colors.white, marginTop: Spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  menuLabel: { flex: 1, marginLeft: Spacing.md, fontSize: FontSize.title - 2, color: Colors.text },
  pressed: { backgroundColor: Colors.background },
  logout: { marginHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: Radius.md },
  version: { marginTop: Spacing.md, textAlign: 'center', fontSize: FontSize.caption + 1, color: Colors.textMuted },
});
