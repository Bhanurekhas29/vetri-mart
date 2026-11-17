// A product list screen body, used for a category, a collection ("See all") and later for search results:
// sub-category chips, a Sort and Filter bar, the product count, a two-column grid that loads 20 at a time.
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/button';
import { HeaderActions } from '@/components/header-actions';
import { FilterSheet } from '@/components/listing/filter-sheet';
import { SortSheet } from '@/components/listing/sort-sheet';
import { ProductTile } from '@/components/product-tile';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/api';
import { activeFilterCount, NO_FILTERS, useListing } from '@/lib/listing';
import type { ListingFilters, ListingScope } from '@/lib/listing';
import type { SortOption } from '@/lib/types';

const GAP = Spacing.sm + 2;
const DEFAULT_SORTS: SortOption[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest first' },
  { value: 'discount', label: 'Discount: highest first' },
];

type Props = { scope: ListingScope; fallbackTitle: string };

export function ProductListing({ scope, fallbackTitle }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - GAP * 3) / 2;

  // the sub-category chip chosen on this screen (null = the screen's own category or collection)
  const [chosenSub, setChosenSub] = useState<string | null>(null);
  const [sort, setSort] = useState('relevance');
  const [filters, setFilters] = useState<ListingFilters>(NO_FILTERS);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const activeScope: ListingScope = { ...scope, category: chosenSub ?? scope.category };
  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, isPlaceholderData } = useListing(activeScope, sort, filters);

  const first = data?.pages[0];
  const products = data?.pages.flatMap((p) => p.results) ?? [];
  const main = first?.category?.main ?? null;
  const chips = main && main.children.length > 0 ? main.children : null;
  const allSlug = main?.slug ?? scope.category;
  const activeChip = chosenSub ?? scope.category;
  const title = first?.category?.main.name ?? first?.collection?.name ?? fallbackTitle;
  const sorts = first?.sorts ?? DEFAULT_SORTS;
  const sortLabel = sorts.find((s) => s.value === sort)?.label ?? 'Relevance';
  const filterCount = activeFilterCount(filters);

  const header = <Stack.Screen options={{ title, headerRight: () => <HeaderActions /> }} />;

  if (isLoading) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }
  if (isError || !first) {
    return (
      <View style={styles.center}>
        {header}
        <Text style={styles.message}>{getErrorMessage(error)}</Text>
        <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.retry} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}

      {chips && (
        <View style={styles.chipsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {[{ name: 'All', slug: allSlug ?? '' }, ...chips].map((chip, i) => {
              const active = i === 0 ? activeChip === allSlug : activeChip === chip.slug;
              return (
                <Pressable
                  key={chip.slug || 'all'}
                  onPress={() => setChosenSub(i === 0 ? null : chip.slug)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.bar}>
        <Pressable onPress={() => setSortOpen(true)} accessibilityRole="button" accessibilityLabel={`Sort: ${sortLabel}`} style={styles.barButton}>
          <Ionicons name="swap-vertical" size={18} color={Colors.navy} />
          <Text style={styles.barText} numberOfLines={1}>
            {sortLabel}
          </Text>
        </Pressable>
        <View style={styles.barDivider} />
        <Pressable onPress={() => setFilterOpen(true)} accessibilityRole="button" accessibilityLabel={filterCount > 0 ? `Filter, ${filterCount} active` : 'Filter'} style={styles.barButton}>
          <Ionicons name="options-outline" size={18} color={Colors.navy} />
          <Text style={styles.barText}>Filter</Text>
          {filterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Text style={styles.count} accessibilityLiveRegion="polite">
        {first.count} {first.count === 1 ? 'product' : 'products'}
      </Text>

      <FlatList
        style={isPlaceholderData && isFetching ? styles.loadingList : undefined}
        data={products}
        numColumns={2}
        keyExtractor={(p) => String(p.id)}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => <ProductTile product={item} width={cardWidth} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshing={false}
        onRefresh={() => refetch()}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.message}>{filterCount > 0 ? 'Try removing some filters.' : 'Please check back soon.'}</Text>
            {filterCount > 0 && <Button title="Clear filters" variant="secondary" onPress={() => setFilters(NO_FILTERS)} style={styles.retry} />}
          </View>
        }
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={Colors.navy} style={styles.footer} /> : undefined}
      />

      <SortSheet visible={sortOpen} options={sorts} value={sort} onPick={setSort} onClose={() => setSortOpen(false)} />
      <FilterSheet visible={filterOpen} scope={activeScope} applied={filters} onApply={setFilters} onClose={() => setFilterOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  message: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  retry: { marginTop: Spacing.md, alignSelf: 'stretch' },
  chipsWrap: { backgroundColor: Colors.white },
  chipsRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  chip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6, marginRight: Spacing.sm },
  chipActive: { borderColor: Colors.navy, backgroundColor: Colors.navy },
  chipText: { fontSize: FontSize.body, color: Colors.text },
  chipTextActive: { color: Colors.white, fontWeight: '700' },
  bar: { flexDirection: 'row', backgroundColor: Colors.white, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  barButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm + 4 },
  barText: { marginLeft: 6, fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.navy, flexShrink: 1 },
  barDivider: { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  filterBadge: { marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  count: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.caption + 1, color: Colors.textMuted },
  grid: { paddingHorizontal: GAP, paddingBottom: Spacing.xl },
  loadingList: { opacity: 0.5 },
  empty: { alignItems: 'center', paddingTop: Spacing.xl },
  emptyTitle: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
  footer: { marginVertical: Spacing.md },
});
