// Edit the photo, name and phone. The email is the verified login, so it cannot be changed here.
// The photo is chosen from the phone's gallery, cropped square, and stored on our server (the account keeps one).
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { FormError, FormScreen } from '@/components/form-screen';
import { TextField } from '@/components/text-field';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { api, getErrorMessage, getFieldErrors } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';

export default function EditProfileScreen() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  async function choosePhoto() {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (picked.canceled || !picked.assets[0]) return;

    setPhotoBusy(true);
    try {
      const form = new FormData();
      // React Native sends a file as { uri, name, type }
      form.append('photo', { uri: picked.assets[0].uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
      const { data } = await api.post<User>('me/photo/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUser(data);
    } catch (e) {
      Alert.alert('Could not upload the photo', getErrorMessage(e));
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto() {
    Alert.alert('Remove your photo?', 'Your initials will be shown instead.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setPhotoBusy(true);
          try {
            const { data } = await api.delete<User>('me/photo/');
            setUser(data);
          } catch (e) {
            Alert.alert('Could not remove the photo', getErrorMessage(e));
          } finally {
            setPhotoBusy(false);
          }
        },
      },
    ]);
  }

  const save = async () => {
    setError('');
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Enter your name.';
    if (phone && !/^[6-9]\d{9}$/.test(phone)) errors.phone = 'Enter a valid 10-digit mobile number.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const { data } = await api.patch<User>('me/', { name: name.trim(), phone });
      setUser(data);
      router.back();
    } catch (e) {
      setFieldErrors(getFieldErrors(e));
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormScreen>
      <View style={styles.photoBlock}>
        <View>
          <Avatar photoUrl={user?.photo_url} name={name || user?.name || ''} email={user?.email ?? ''} size={96} />
          {photoBusy && (
            <View style={styles.busy}>
              <ActivityIndicator color={Colors.white} />
            </View>
          )}
        </View>
        <View style={styles.photoLinks}>
          <Pressable onPress={choosePhoto} disabled={photoBusy} accessibilityRole="button" accessibilityLabel={user?.photo_url ? 'Change photo' : 'Add a photo'} hitSlop={8}>
            <Text style={styles.link}>{user?.photo_url ? 'Change photo' : 'Add a photo'}</Text>
          </Pressable>
          {user?.photo_url ? (
            <Pressable onPress={removePhoto} disabled={photoBusy} accessibilityRole="button" accessibilityLabel="Remove photo" hitSlop={8}>
              <Text style={styles.remove}>Remove photo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <TextField label="Email" value={user?.email ?? ''} editable={false} hint="Your email is your login and cannot be changed." />
      <TextField label="Full name" value={name} onChangeText={setName} autoCapitalize="words" error={fieldErrors.name} />
      <TextField
        label="Mobile number"
        value={phone}
        onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
        keyboardType="number-pad"
        placeholder="10-digit number"
        hint="Used by the courier to reach you."
        error={fieldErrors.phone}
      />
      <FormError message={Object.keys(fieldErrors).length > 0 ? undefined : error} />
      <Button title="Save" onPress={save} loading={loading} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  photoBlock: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  busy: { ...(StyleSheet.absoluteFill as object), borderRadius: 48, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  photoLinks: { marginLeft: Spacing.lg, gap: Spacing.md },
  link: { fontSize: FontSize.body + 1, fontWeight: '700', color: Colors.navy },
  remove: { fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.error },
});
