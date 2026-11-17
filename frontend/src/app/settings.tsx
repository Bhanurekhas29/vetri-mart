// Settings: password, log out everywhere, email preferences, and links to Help, Terms, Privacy and About.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Colors, FontSize, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';

type PreferenceKey = 'email_order_updates' | 'email_offers';

export default function SettingsScreen() {
  const { user, setUser, signOut } = useAuth();
  const [saving, setSaving] = useState(false);

  const logoutEverywhere = () => {
    Alert.alert('Log out from all devices?', 'You will be logged out here and on every other phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post('auth/logout-all/');
          } catch (e) {
            Alert.alert('Could not log out', getErrorMessage(e));
            return;
          }
          await signOut();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const togglePreference = async (key: PreferenceKey, value: boolean) => {
    if (!user) return;
    const before = user;
    setUser({ ...user, [key]: value }); // show the change straight away
    setSaving(true);
    try {
      const { data } = await api.patch<User>('me/', { [key]: value });
      setUser(data);
    } catch (e) {
      setUser(before); // put it back if the server said no
      Alert.alert('Could not save', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <Text style={styles.section}>Account</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => router.push('/set-password')}>
          <Text style={styles.label}>{user.has_password ? 'Change password' : 'Set a password'}</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={logoutEverywhere}>
          <Text style={styles.label}>Log out from all devices</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Email notifications</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Order updates</Text>
          <Switch
            value={user.email_order_updates}
            onValueChange={(v) => togglePreference('email_order_updates', v)}
            disabled={saving}
            trackColor={{ true: Colors.orange }}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Offers and deals</Text>
          <Switch
            value={user.email_offers}
            onValueChange={(v) => togglePreference('email_offers', v)}
            disabled={saving}
            trackColor={{ true: Colors.orange }}
          />
        </View>
      </View>

      <Text style={styles.section}>Help and information</Text>
      <View style={styles.card}>
        {[
          { label: 'Help', path: '/help' },
          { label: 'Terms and conditions', path: '/page/terms' },
          { label: 'Privacy policy', path: '/page/privacy' },
          { label: 'About Vetri Mart', path: '/page/about' },
        ].map((item) => (
          <Pressable key={item.path} style={styles.row} onPress={() => router.push(item.path)} accessibilityRole="button" accessibilityLabel={item.label}>
            <Text style={styles.label}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingVertical: Spacing.md },
  section: {
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  label: { fontSize: FontSize.title - 2, color: Colors.text },
});
