// The search screen. Empty box: "Recent searches" (on this phone) and "Popular searches" (from the server).
// While typing: suggestions (products with a picture, and categories). Submitting opens the results list.
import { Ionicons } from '@expo/vector-icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Picture } from '@/components/picture';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '@/lib/recent-searches';

type Suggestions = {
  products: { slug: string; name: string; category: string; image: string | null; image_alt: string }[];
  categories: { slug: string; name: string; parent: string | null }[];
};

const MIN_CHARS = 2;

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const typed = text.trim();
  const debounced = useDebounced(typed, 250);

  // read the phone's recent searches each time this screen opens
  useEffect(() => {
    let active = true;
    getRecentSearches().then((list) => {
      if (active) setRecent(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const popular = useQuery({
    queryKey: ['popular-searches'],
    staleTime: 60_000,
    queryFn: async () => (await api.get<{ terms: string[] }>('search/popular/')).data.terms,
  });

  const suggest = useQuery({
    queryKey: ['search-suggest', debounced],
    enabled: debounced.length >= MIN_CHARS,
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<Suggestions>('search/suggest/', { params: { q: debounced } })).data,
  });

  async function submit(term: string) {
    const clean = term.trim().replace(/\s+/g, ' ');
    if (clean.length < MIN_CHARS) return;
    Keyboard.dismiss();
    setRecent(await addRecentSearch(clean));
    api.post('search/log/', { q: clean }).catch(() => undefined); // counting a search never blocks the search
    router.push({ pathname: '/search-results', params: { q: clean } });
  }

  const showSuggestions = typed.length >= MIN_CHARS;
  const suggestions = suggest.data;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.top, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </Pressable>
        <View style={styles.field}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => submit(text)}
            placeholder="Search products"
            placeholderTextColor={Colors.textMuted}
            autoCorrect={false}
            maxLength={100}
            style={styles.input}
            accessibilityLabel="Search products"
          />
          {text.length > 0 && (
            <Pressable
              onPress={() => {
                setText('');
                inputRef.current?.focus();
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search text">
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {showSuggestions ? (
          <View>
            <Pressable onPress={() => submit(text)} accessibilityRole="button" accessibilityLabel={`Search for ${typed}`} style={styles.row}>
              <Ionicons name="search-outline" size={20} color={Colors.navy} />
              <Text style={styles.rowText} numberOfLines={1}>
                Search for <Text style={styles.bold}>&quot;{typed}&quot;</Text>
              </Text>
            </Pressable>

            {suggestions?.categories.map((c) => (
              <Pressable
                key={`c-${c.slug}`}
                onPress={() => {
                  Keyboard.dismiss();
                  router.push(`/category/${c.slug}`);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Category ${c.name}${c.parent ? ` in ${c.parent}` : ''}`}
                style={styles.row}>
                <Ionicons name="grid-outline" size={20} color={Colors.navy} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{c.name}</Text>
                  <Text style={styles.rowSub}>{c.parent ? `in ${c.parent}` : 'Category'}</Text>
                </View>
              </Pressable>
            ))}

            {suggestions?.products.map((p) => (
              <Pressable
                key={`p-${p.slug}`}
                onPress={() => {
                  Keyboard.dismiss();
                  router.push(`/product/${p.slug}`);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}, in ${p.category}`}
                style={styles.row}>
                <Picture uri={p.image} alt={p.image_alt || p.name} contentFit="contain" icon="cube-outline" iconSize={18} style={styles.thumb} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.rowSub}>in {p.category}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View>
            {recent.length > 0 && (
              <View style={styles.block}>
                <View style={styles.blockHead}>
                  <Text style={styles.blockTitle} accessibilityRole="header">
                    Recent searches
                  </Text>
                  <Pressable
                    onPress={async () => {
                      await clearRecentSearches();
                      setRecent([]);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Clear recent searches">
                    <Text style={styles.clear}>Clear</Text>
                  </Pressable>
                </View>
                <View style={styles.chips}>
                  {recent.map((term) => (
                    <Pressable key={term} onPress={() => submit(term)} accessibilityRole="button" accessibilityLabel={`Search ${term}`} style={styles.chip}>
                      <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.chipText}>{term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {popular.data && popular.data.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockTitle} accessibilityRole="header">
                  Popular searches
                </Text>
                <View style={styles.chips}>
                  {popular.data.map((term) => (
                    <Pressable key={term} onPress={() => submit(term)} accessibilityRole="button" accessibilityLabel={`Search ${term}`} style={styles.chip}>
                      <Ionicons name="trending-up" size={14} color={Colors.textMuted} />
                      <Text style={styles.chipText}>{term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {recent.length === 0 && !(popular.data && popular.data.length > 0) && (
              <Text style={styles.hint}>Type a product, brand or category, for example &quot;earbuds&quot;.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  top: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.navy, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  back: { marginRight: Spacing.md },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: Radius.md, paddingHorizontal: Spacing.md, minHeight: 44 },
  input: { flex: 1, marginHorizontal: Spacing.sm, fontSize: FontSize.body + 1, color: Colors.text, paddingVertical: 8 },
  body: { paddingBottom: Spacing.xl },
  block: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blockTitle: { fontSize: FontSize.title - 2, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  clear: { fontSize: FontSize.body, fontWeight: '600', color: Colors.navy, marginBottom: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginRight: Spacing.sm, marginBottom: Spacing.sm },
  chipText: { marginLeft: 6, fontSize: FontSize.body, color: Colors.text },
  hint: { padding: Spacing.lg, fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowBody: { flex: 1, marginLeft: Spacing.md },
  rowText: { flex: 1, marginLeft: Spacing.md, fontSize: FontSize.body + 1, color: Colors.text },
  rowTitle: { fontSize: FontSize.body + 1, color: Colors.text },
  rowSub: { fontSize: FontSize.caption + 1, color: Colors.textMuted },
  bold: { fontWeight: '700' },
  thumb: { width: 44, height: 44, borderRadius: Radius.md },
});
