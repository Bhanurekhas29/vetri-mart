// A soft grey block that gently pulses. Used while the Home page is loading for the first time.
import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const [opacity] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.block, style, { opacity }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: Colors.navySoft, borderRadius: Radius.md },
});
