// Full-screen picture viewer for the product page.
// Pinch to zoom, double-tap to zoom in and out, drag a zoomed picture around, swipe sideways to change picture
// (swiping is paused while a picture is zoomed in, so dragging it does not change the picture).
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Picture } from '@/components/picture';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { ProductImage } from '@/lib/types';

const MAX_ZOOM = 3;
const DOUBLE_TAP_ZOOM = 2;

type PageProps = { image: ProductImage | null; productName: string; width: number; height: number; onZoomChange: (zoomed: boolean) => void };

function ZoomPage({ image, productName, width, height, onZoomChange }: PageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);

  function reportZoom(value: boolean) {
    setZoomed(value);
    onZoomChange(value);
  }

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_ZOOM);
    },
    onDeactivate: () => {
      'worklet';
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
        savedScale.value = 1;
        scheduleOnRN(reportZoom, false);
      } else {
        savedScale.value = scale.value;
        scheduleOnRN(reportZoom, true);
      }
    },
  });

  // Dragging only works (and only takes the touch from the swipe) while zoomed in.
  const pan = usePanGesture({
    enabled: zoomed,
    onUpdate: (e) => {
      'worklet';
      const limitX = ((scale.value - 1) * width) / 2;
      const limitY = ((scale.value - 1) * height) / 2;
      x.value = Math.min(Math.max(savedX.value + e.translationX, -limitX), limitX);
      y.value = Math.min(Math.max(savedY.value + e.translationY, -limitY), limitY);
    },
    onDeactivate: () => {
      'worklet';
      savedX.value = x.value;
      savedY.value = y.value;
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      'worklet'; // runs once the second tap is recognised
      if (scale.value > 1) {
        scale.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
        savedScale.value = 1;
        savedX.value = 0;
        savedY.value = 0;
        scheduleOnRN(reportZoom, false);
      } else {
        scale.value = withTiming(DOUBLE_TAP_ZOOM);
        savedScale.value = DOUBLE_TAP_ZOOM;
        scheduleOnRN(reportZoom, true);
      }
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <View style={{ width, height }}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ width, height }, style]}>
          <Picture uri={image?.url} alt={image?.alt || productName} contentFit="contain" icon="cube-outline" iconSize={64} style={{ width, height }} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

type Props = {
  visible: boolean;
  images: ProductImage[];
  startIndex: number;
  productName: string;
  onClose: () => void;
};

export function ZoomViewer({ visible, images, startIndex, productName, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const listRef = useRef<FlatList<ProductImage | null>>(null);
  const slides: (ProductImage | null)[] = images.length > 0 ? images : [null];

  function onSwipeEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar hidden={visible} />
        <FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(item, i) => String(item?.id ?? `none-${i}`)}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(startIndex, slides.length - 1)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onSwipeEnd}
          renderItem={({ item }) => (
            <ZoomPage image={item} productName={productName} width={width} height={height} onZoomChange={setZoomed} />
          )}
        />

        <View style={styles.topBar} pointerEvents="box-none">
          {slides.length > 1 ? (
            <View style={styles.counter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.counterText}>
                {index + 1} / {slides.length}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close picture" hitSlop={12} style={styles.close}>
            <Ionicons name="close" size={26} color={Colors.white} />
          </Pressable>
        </View>

        <Text style={styles.hint} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          Pinch or double-tap to zoom
        </Text>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 44,
    paddingHorizontal: Spacing.md,
  },
  counter: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  counterText: { color: Colors.white, fontSize: FontSize.body, fontWeight: '600' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', bottom: 36, alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: FontSize.caption + 1 },
});
