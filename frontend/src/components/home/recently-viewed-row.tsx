// "Recently viewed": products this phone opened lately. The slugs are remembered on the phone only;
// the cards themselves come fresh from the server. Shown only when there is something to show.
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { ProductRowSection } from '@/components/home/product-row-section';
import { api } from '@/lib/api';
import { getRecentSlugs } from '@/lib/recently-viewed';
import type { ProductCard } from '@/lib/types';

export function RecentlyViewedRow() {
  const [slugs, setSlugs] = useState<string[]>([]);

  // Read the list each time the Home tab comes into view (for example after coming back from a product).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getRecentSlugs().then((list) => {
        if (active) setSlugs((old) => (old.join(',') === list.join(',') ? old : list));
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const key = slugs.join(',');
  const { data } = useQuery({
    queryKey: ['recently-viewed', key],
    enabled: slugs.length > 0,
    queryFn: async () => (await api.get<ProductCard[]>('home/recent/', { params: { slugs: key } })).data,
  });

  if (slugs.length === 0 || !data || data.length === 0) return null;
  return (
    <ProductRowSection
      title="Recently viewed"
      collection={{ slug: '', name: 'Recently viewed' }}
      products={data}
      hasMore={false}
    />
  );
}
