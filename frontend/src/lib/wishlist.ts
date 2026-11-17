// The shopper's wishlist, shared by every heart in the app and the Wishlist tab.
// Guests tapping a heart are sent to log in; the product is saved right after they log in, and a heart tapped on a
// product page returns them to that page.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';

import { api } from './api';
import { setPostLoginRoute, useAuth } from './auth';
import type { WishlistResponse } from './types';

type Savable = { id: number; slug: string };

// The product the guest wanted to save before logging in (module-level so it survives the login screens).
let pendingSave: { slug: string; at: number } | null = null;
const PENDING_MAX_AGE_MS = 10 * 60 * 1000;

export function useWishlist() {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const signedIn = status === 'signedIn';

  const query = useQuery({
    queryKey: ['wishlist'],
    enabled: signedIn,
    queryFn: async () => (await api.get<WishlistResponse>('wishlist/')).data,
  });

  const ids = useMemo(() => new Set(query.data?.items.map((i) => i.product.id) ?? []), [query.data]);

  // Finish a save that was waiting for the login.
  useEffect(() => {
    if (!signedIn || !pendingSave) return;
    const { slug, at } = pendingSave;
    pendingSave = null;
    if (Date.now() - at > PENDING_MAX_AGE_MS) return;
    api
      .put(`wishlist/${slug}/`)
      .then(() => queryClient.invalidateQueries({ queryKey: ['wishlist'] }))
      .catch(() => undefined);
  }, [signedIn, queryClient]);

  const isSaved = useCallback((productId: number) => ids.has(productId), [ids]);

  // Saves or removes. Returns false when the shopper had to be sent to log in.
  const toggle = useCallback(
    async (product: Savable): Promise<boolean> => {
      if (!signedIn) {
        pendingSave = { slug: product.slug, at: Date.now() };
        setPostLoginRoute(pathname.startsWith('/product/') ? pathname : null);
        router.push('/login');
        return false;
      }
      if (ids.has(product.id)) {
        await api.delete(`wishlist/${product.slug}/`);
      } else {
        await api.put(`wishlist/${product.slug}/`);
      }
      await queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      return true;
    },
    [signedIn, ids, pathname, queryClient],
  );

  const remove = useCallback(
    async (product: Savable) => {
      await api.delete(`wishlist/${product.slug}/`);
      await queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
    [queryClient],
  );

  return { ...query, items: query.data?.items ?? [], count: query.data?.count ?? 0, isSaved, toggle, remove, signedIn };
}
