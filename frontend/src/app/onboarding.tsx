// The welcome slides shown on the first launch. The slides come from the admin panel.
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import type { OnboardingSlide } from '@/lib/types';

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [index, setIndex] = useState(0);

  const { data: slides, isLoading, isError } = useQuery({
    queryKey: ['onboarding'],
    queryFn: async () => (await api.get<OnboardingSlide[]>('onboarding/')).data,
  });

  const goToLogin = () => router.replace('/login');

  // If the slides cannot be loaded (or there are none), skip straight to login.
  useEffect(() => {
    if (isError || (slides && slides.length === 0)) goToLogin();
  }, [isError, slides]);

  if (isLoading || !slides || slides.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }

  const isLast = index === slides.length - 1;

  const next = () => {
    if (isLast) {
      goToLogin();
    } else {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.skipRow}>
        <Pressable onPress={goToLogin} hitSlop={12}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(slide) => String(slide.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={styles.image}
                contentFit="contain"
                accessibilityLabel={item.alt_text}
                alt={item.alt_text}
              />
            ) : (
              <View style={styles.iconCircle}>
                <Ionicons name="bag-handle-outline" size={64} color={Colors.navy} />
              </View>
            )}
            <Text style={styles.title}>{item.title}</Text>
            {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
          </View>
        )}
      />

      <View style={styles.dots}>
        {slides.map((slide, i) => (
          <View key={slide.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Button title={isLast ? 'Get started' : 'Next'} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  skip: { fontSize: FontSize.body, color: Colors.textMuted },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  image: { width: 220, height: 220, marginBottom: Spacing.lg },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.navySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSize.heading, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: FontSize.title - 2, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: Spacing.md },
  dot: { width: 6, height: 6, borderRadius: Radius.pill, backgroundColor: Colors.border, marginHorizontal: 3 },
  dotActive: { width: 18, backgroundColor: Colors.orange },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
});
