// Product lists (category, collection, search): the sort, the filters and the paged loading.
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { api } from './api';
import type { ListingPage } from './types';

export type ListingScope = { category?: string; collection?: string; q?: string };

export type ListingFilters = {
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  brands: string[]; // brand slugs
  minDiscount: number | null;
  colours: number[];
  sizes: number[];
};

export const NO_FILTERS: ListingFilters = { minPrice: '', maxPrice: '', inStock: false, brands: [], minDiscount: null, colours: [], sizes: [] };

// How many kinds of filter are switched on (the number shown on the Filter button).
export function activeFilterCount(f: ListingFilters): number {
  return (
    (f.minPrice || f.maxPrice ? 1 : 0) +
    (f.inStock ? 1 : 0) +
    (f.brands.length > 0 ? 1 : 0) +
    (f.minDiscount !== null ? 1 : 0) +
    (f.colours.length > 0 ? 1 : 0) +
    (f.sizes.length > 0 ? 1 : 0)
  );
}

export function listingParams(scope: ListingScope, sort: string, f: ListingFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (scope.category) params.category = scope.category;
  if (scope.collection) params.collection = scope.collection;
  if (scope.q) params.q = scope.q;
  if (sort !== 'relevance') params.sort = sort;
  if (f.minPrice) params.min_price = f.minPrice;
  if (f.maxPrice) params.max_price = f.maxPrice;
  if (f.inStock) params.in_stock = '1';
  if (f.brands.length) params.brand = f.brands.join(',');
  if (f.minDiscount !== null) params.min_discount = String(f.minDiscount);
  if (f.colours.length) params.colour = f.colours.join(',');
  if (f.sizes.length) params.size = f.sizes.join(',');
  return params;
}

export function useListing(scope: ListingScope, sort: string, filters: ListingFilters) {
  const params = listingParams(scope, sort, filters);
  return useInfiniteQuery({
    queryKey: ['listing', params],
    initialPageParam: 1,
    placeholderData: keepPreviousData, // keep showing the old list while the new one loads
    queryFn: async ({ pageParam }) => (await api.get<ListingPage>('products/', { params: { ...params, page: pageParam } })).data,
    getNextPageParam: (last) => last.next_page ?? undefined,
  });
}
