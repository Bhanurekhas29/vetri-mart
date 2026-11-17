// The moving line under the pincode bar, like an HTML marquee: all live announcements run in ONE line,
// right to left, again and again. The messages come from the admin's Announcements menu.
// Nothing live = nothing drawn. If the phone's "reduce motion" setting is on, the line stands still.
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { Colors, FontSize, Spacing } from '@/constants/theme';
import type { AnnouncementSpeed } from '@/lib/types';

// The admin picks Slow, Normal or Fast; these are how many pixels the text moves each second.
const SPEEDS: Record<AnnouncementSpeed, number> = { slow: 35, normal: 55, fast: 85 };
const SEPARATOR = '   •   ';

export function AnnouncementBar({ messages, speed = 'normal' }: { messages: string[]; speed?: AnnouncementSpeed }) {
  const pxPerSecond = SPEEDS[speed] ?? SPEEDS.normal;
  const [boxWidth, setBoxWidth] = useState(0);
  const [unitWidth, setUnitWidth] = useState(0); // width of one full pass of the messages
  const [reduceMotion, setReduceMotion] = useState(false);
  const [x] = useState(() => new Animated.Value(0));

  const unit = messages.join(SEPARATOR) + SEPARATOR;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (active) setReduceMotion(on);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || unitWidth <= 0) return;
    x.setValue(0);
    const run = Animated.loop(
      Animated.timing(x, {
        toValue: -unitWidth,
        duration: (unitWidth / pxPerSecond) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    run.start();
    return () => run.stop();
  }, [reduceMotion, unitWidth, unit, pxPerSecond, x]);

  if (messages.length === 0) return null;

  // enough copies to always fill the strip while one copy slides out
  const copies = unitWidth > 0 && boxWidth > 0 ? Math.ceil(boxWidth / unitWidth) + 1 : 2;

  return (
    <View
      style={styles.bar}
      onLayout={(e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Announcement: ${messages.join('. ')}`}>
      {reduceMotion ? (
        <Text style={[styles.text, styles.still]} numberOfLines={1}>
          {messages.join(SEPARATOR)}
        </Text>
      ) : (
        <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
          <Animated.View style={[styles.row, { transform: [{ translateX: x }] }]}>
            {Array.from({ length: copies }).map((_, i) => (
              <Text
                key={i}
                style={styles.text}
                numberOfLines={1}
                onLayout={i === 0 ? (e) => setUnitWidth(e.nativeEvent.layout.width) : undefined}>
                {unit}
              </Text>
            ))}
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: Colors.navy, height: 30, justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { color: Colors.white, fontSize: FontSize.caption + 1, fontWeight: '600' },
  still: { paddingHorizontal: Spacing.md },
});
