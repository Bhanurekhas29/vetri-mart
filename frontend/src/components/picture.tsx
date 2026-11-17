// Shows an uploaded picture, or a soft grey tile with an icon when there is no picture yet.
// Used for category tiles, product cards and banners, so every screen handles "no picture" the same way.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';

import { Colors } from '@/constants/theme';

type Props = {
  uri?: string | null;
  alt?: string; // the alt text typed in the admin; read out by screen readers
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconSize?: number;
};

export function Picture({ uri, alt, style, contentFit = 'cover', icon = 'image-outline', iconSize = 24 }: Props) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={style}
        contentFit={contentFit}
        alt={alt}
        accessibilityLabel={alt}
        transition={150}
      />
    );
  }
  return (
    <View style={[styles.placeholder, style as object]} accessibilityElementsHidden importantForAccessibility="no">
      <Ionicons name={icon} size={iconSize} color={Colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: Colors.navySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
