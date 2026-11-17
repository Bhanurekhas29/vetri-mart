// Rate and review a product the shopper has received. One review per product: writing again edits it.
// Only a delivered order unlocks this (the server checks), and the review then shows "Verified purchase".
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Picture } from '@/components/picture';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import type { MyReviewInfo } from '@/lib/types';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

type Draft = { rating: number; title: string; body: string };

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-review', slug],
    enabled: !!slug,
    queryFn: async () => (await api.get<MyReviewInfo>(`products/${slug}/my-review/`)).data,
  });
  // what the shopper has changed so far; until then the saved review (if any) is shown
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error2, setError2] = useState('');

  const existing = data?.review ?? null;
  const header = <Stack.Screen options={{ title: existing ? 'Edit your review' : 'Rate and review' }} />;

  if (isLoading) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.center}>
        {header}
        <Text style={styles.message}>{getErrorMessage(error)}</Text>
        <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.cta} />
      </View>
    );
  }
  if (!data.can_review) {
    return (
      <View style={styles.center}>
        {header}
        <Ionicons name="lock-closed-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.title}>Reviews open after delivery</Text>
        <Text style={styles.message}>{data.message}</Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} style={styles.cta} />
      </View>
    );
  }

  const current: Draft = draft ?? { rating: existing?.rating ?? 0, title: existing?.title ?? '', body: existing?.body ?? '' };
  const change = (patch: Partial<Draft>) => {
    setError2('');
    setDraft({ ...current, ...patch });
  };

  function refreshEverywhere() {
    for (const key of [['product', slug], ['reviews', slug], ['my-review', slug], ['my-reviews'], ['order'], ['orders']]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }

  async function save() {
    if (current.rating < 1) {
      setError2('Please tap the stars to rate this product.');
      return;
    }
    setBusy('save');
    try {
      await api.put(`products/${slug}/my-review/`, { rating: current.rating, title: current.title.trim(), body: current.body.trim() });
      refreshEverywhere();
      router.back();
    } catch (e) {
      setError2(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete your review?', 'It will be removed from the product page.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            await api.delete(`products/${slug}/my-review/`);
            refreshEverywhere();
            router.back();
          } catch (e) {
            setError2(getErrorMessage(e));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: Spacing.xl + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={styles.product}>
          <Picture uri={data.product.image} alt={data.product.image_alt || data.product.name} contentFit="contain" icon="cube-outline" style={styles.image} />
          <Text style={styles.productName} numberOfLines={3}>
            {data.product.name}
          </Text>
        </View>

        <Text style={styles.label}>Your rating</Text>
        <View style={styles.stars} accessibilityRole="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              onPress={() => change({ rating: n })}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}, ${LABELS[n]}`}
              accessibilityState={{ selected: current.rating === n }}>
              <Ionicons name={current.rating >= n ? 'star' : 'star-outline'} size={40} color={current.rating >= n ? Colors.success : Colors.textMuted} />
            </Pressable>
          ))}
        </View>
        <Text style={styles.ratingLabel}>{LABELS[current.rating] || 'Tap a star'}</Text>

        <Text style={styles.label}>Title (optional)</Text>
        <TextInput
          value={current.title}
          onChangeText={(t) => change({ title: t.slice(0, 120) })}
          placeholder="Sum it up in a few words"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
          accessibilityLabel="Review title"
        />

        <Text style={styles.label}>Your review (optional)</Text>
        <TextInput
          value={current.body}
          onChangeText={(t) => change({ body: t.slice(0, 2000) })}
          placeholder="What did you like or dislike? How did you use it?"
          placeholderTextColor={Colors.textMuted}
          multiline
          style={[styles.input, styles.multiline]}
          accessibilityLabel="Review text"
        />
        <Text style={styles.count}>{current.body.length} / 2000</Text>

        {error2 ? <Text style={styles.error}>{error2}</Text> : null}
        <Button title={existing ? 'Update review' : 'Submit review'} onPress={save} loading={busy === 'save'} disabled={busy !== null} style={styles.cta} />
        {existing && <Button title="Delete review" variant="danger" onPress={confirmDelete} loading={busy === 'delete'} disabled={busy !== null} style={styles.second} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  title: { fontSize: FontSize.heading, fontWeight: '600', color: Colors.text, marginTop: Spacing.md, textAlign: 'center' },
  message: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  body: { padding: Spacing.md },
  product: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  image: { width: 64, height: 64, borderRadius: Radius.md },
  productName: { flex: 1, marginLeft: Spacing.md, fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  label: { marginTop: Spacing.lg, marginBottom: Spacing.sm, fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  stars: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.sm },
  ratingLabel: { marginTop: Spacing.sm, textAlign: 'center', fontSize: FontSize.body + 1, color: Colors.success, fontWeight: '600' },
  input: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.body + 1, color: Colors.text },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  count: { alignSelf: 'flex-end', marginTop: 4, fontSize: FontSize.caption, color: Colors.textMuted },
  error: { marginTop: Spacing.md, fontSize: FontSize.body, color: Colors.error, textAlign: 'center' },
  cta: { marginTop: Spacing.lg, alignSelf: 'stretch' },
  second: { marginTop: Spacing.sm, alignSelf: 'stretch' },
});
