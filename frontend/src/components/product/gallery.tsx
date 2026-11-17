// The picture gallery at the top of the product page: swipe the big picture, or tap a small one below.
// A "Watch video" button appears when the admin gave a video link.
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { Picture } from '@/components/picture';
import { ZoomViewer } from '@/components/product/zoom-viewer';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { ProductImage } from '@/lib/types';

type Props = { images: ProductImage[]; productName: string; videoUrl: string };

export function Gallery({ images, productName, videoUrl }: Props) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const listRef = useRef<FlatList<ProductImage | null>>(null);
  const slides: (ProductImage | null)[] = images.length > 0 ? images : [null]; // null = "no picture yet" tile
  const height = Math.min(width, 420);

  function goTo(i: number) {
    setIndex(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
  }

  function onSwipeEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item, i) => String(item?.id ?? `none-${i}`)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={onSwipeEnd}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => item && setViewerOpen(true)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${item?.alt || productName}. Tap to zoom`}
            style={{ width, height }}>
            <Picture
              uri={item?.url}
              alt={item?.alt || productName}
              contentFit="contain"
              icon="cube-outline"
              iconSize={64}
              style={{ width, height }}
            />
          </Pressable>
        )}
      />

      {images.length > 0 && (
        <ZoomViewer
          key={viewerOpen ? `open-${index}` : 'closed'}
          visible={viewerOpen}
          images={images}
          startIndex={index}
          productName={productName}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {slides.length > 1 && (
        <View style={styles.counter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.counterText}>
            {index + 1} / {slides.length}
          </Text>
        </View>
      )}

      {videoUrl ? (
        <Pressable
          onPress={() => Linking.openURL(videoUrl).catch(() => undefined)}
          accessibilityRole="button"
          accessibilityLabel="Watch product video"
          style={styles.video}>
          <Ionicons name="play-circle" size={18} color={Colors.white} />
          <Text style={styles.videoText}>Watch video</Text>
        </Pressable>
      ) : null}

      {slides.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
          {slides.map((item, i) => (
            <Pressable
              key={String(item?.id ?? i)}
              onPress={() => goTo(i)}
              accessibilityRole="button"
              accessibilityLabel={`Show picture ${i + 1}`}
              accessibilityState={{ selected: i === index }}
              style={[styles.thumb, i === index && styles.thumbActive]}>
              <Picture uri={item?.url} alt={item?.alt} contentFit="contain" style={styles.thumbImage} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: Colors.white },
  counter: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  counterText: { color: Colors.white, fontSize: FontSize.caption, fontWeight: '600' },
  video: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  videoText: { color: Colors.white, fontSize: FontSize.caption, fontWeight: '600', marginLeft: 4 },
  thumbs: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  thumb: {
    width: 56,
    height: 56,
    marginRight: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  thumbActive: { borderColor: Colors.navy },
  thumbImage: { width: '100%', height: '100%' },
});
