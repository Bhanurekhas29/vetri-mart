// The round profile picture: the uploaded photo, or the person's initials on orange when there is none.
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

export function initials(name: string, email: string): string {
  const parts = (name.trim() || email).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

type Props = { photoUrl?: string; name: string; email: string; size?: number };

export function Avatar({ photoUrl, name, email, size = 56 }: Props) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={round} contentFit="cover" accessibilityLabel={`Profile photo of ${name || email}`} />;
  }
  return (
    <View style={[styles.initials, round]} accessibilityLabel={`Profile picture with initials ${initials(name, email)}`}>
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials(name, email)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initials: { backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  text: { color: Colors.white, fontWeight: '600' },
});
