// The banner carousel (and the mid-page banner). Swipe sideways, or wait: it moves on by itself every 4 seconds.
// A tap opens what the admin chose for that banner: a category, a product or a collection.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { Picture } from '@/components/picture';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Banner } from '@/lib/types';

const AUTO_MOVE_MS = 4000;
const PAUSE_AFTER_TOUCH_MS = 8000;

function open(banner: Banner) {
  if (!banner.target) return;
  const { type, slug } = banner.target;
  router.push(`/${type}/${slug}`);
}

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Banner>>(null);
  const indexRef = useRef(0);
  const pausedUntil = useRef(0);
  const count = banners.length;

  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      const next = (indexRef.current + 1) % count;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      indexRef.current = next;
      setIndex(next);
    }, AUTO_MOVE_MS);
    return () => clearInterval(timer);
  }, [count]);

  function onSwipeEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    indexRef.current = next;
    setIndex(next);
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={banners}
        keyExtractor={(banner) => String(banner.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onScrollBeginDrag={() => {
          pausedUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS;
        }}
        onMomentumScrollEnd={onSwipeEnd}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            disabled={!item.target}
            accessibilityRole={item.target ? 'button' : 'image'}
            accessibilityLabel={item.alt_text}
            style={{ width, paddingHorizontal: Spacing.md }}>
            <Picture uri={item.image} alt={item.alt_text} style={styles.image} />
          </Pressable>
        )}
      />
      {count > 1 && (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {banners.map((banner, i) => (
            <View key={banner.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  image: { width: '100%', aspectRatio: 2, borderRadius: Radius.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 3, backgroundColor: Colors.border },
  dotActive: { width: 18, backgroundColor: Colors.navy },
});
