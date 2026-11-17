// The shopper's cart, shared by the cart screen, the cart icon count and every Add to cart button.
//   Logged in: the cart lives on the server and follows the shopper to any phone.
//   Guest:     the cart lives on this phone (lib/guest-cart.ts); the server only prices it.
// At login the phone's cart is merged into the account's cart, then forgotten here.
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { api } from './api';
import { useAuth } from './auth';
import { GUEST_MAX_LINES, readGuestLines, writeGuestLines } from './guest-cart';
import type { GuestLine } from './guest-cart';
import type { AddToCartResult, Cart } from './types';

const EMPTY_CART: Cart = {
  items: [],
  saved_items: [],
  count: 0,
  lines: 0,
  summary: {
    units: 0, mrp_total: '0.00', discount: '0.00', subtotal: '0.00', bundle_savings: '0.00', items_total: '0.00',
    coupon_code: '', coupon_discount: '0.00', delivery_fee: '0.00', free_delivery_above: '0.00', total: '0.00', you_save: '0.00',
  },
  bundles: [],
  bundle_suggestions: [],
  coupon: null,
  can_checkout: false,
  blocking_lines: 0,
};

export type AddResult = { added: AddToCartResult['added'] };

const guestPayload = (lines: GuestLine[]) => ({
  lines: lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity, saved: l.saved })),
});

// After login: add the phone's cart to the account's cart. Runs once even if several screens ask at the same time.
let merging: Promise<void> | null = null;
async function mergeGuestCart(queryClient: QueryClient) {
  if (merging) return merging;
  merging = (async () => {
    try {
      const lines = await readGuestLines();
      if (lines.length === 0) return;
      const { data } = await api.post<Cart>('cart/merge/', guestPayload(lines));
      queryClient.setQueryData(['cart'], data);
      await writeGuestLines([]);
      queryClient.setQueryData(['guest-lines'], []);
    } catch {
      // keep the phone's cart; the merge is tried again next time
    } finally {
      merging = null;
    }
  })();
  return merging;
}

export function useCart() {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const signedIn = status === 'signedIn';
  const guest = status === 'signedOut';

  // ---- logged in ----
  const server = useQuery({
    queryKey: ['cart'],
    enabled: signedIn,
    queryFn: async () => (await api.get<Cart>('cart/')).data,
  });

  useEffect(() => {
    if (signedIn) mergeGuestCart(queryClient);
  }, [signedIn, queryClient]);

  // ---- guest ----
  const stored = useQuery({
    queryKey: ['guest-lines'],
    enabled: guest,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: readGuestLines,
  });
  const lines = stored.data ?? [];
  const linesKey = lines.map((l) => `${l.variantId}:${l.quantity}:${l.saved ? 1 : 0}`).join(',');

  const priced = useQuery({
    queryKey: ['cart-guest', linesKey],
    enabled: guest && stored.isSuccess && lines.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.post<Cart>('cart/preview/', guestPayload(lines));
      if (data.missing && data.missing.length > 0) {
        // versions that no longer exist are forgotten
        const gone = new Set(data.missing);
        const kept = lines.filter((l) => !gone.has(l.variantId));
        await writeGuestLines(kept);
        queryClient.setQueryData(['guest-lines'], kept);
      }
      return data;
    },
  });

  const saveLines = useCallback(
    async (next: GuestLine[]) => {
      await writeGuestLines(next);
      queryClient.setQueryData(['guest-lines'], next);
    },
    [queryClient],
  );
  const currentLines = useCallback(async () => queryClient.getQueryData<GuestLine[]>(['guest-lines']) ?? (await readGuestLines()), [queryClient]);

  // ---- actions (same names for guests and logged-in shoppers) ----
  // `knownStock` lets the product page limit a guest's quantity to the stock it is showing.
  const add = useCallback(
    async (variantId: number, quantity = 1, knownStock?: number): Promise<AddResult> => {
      if (signedIn) {
        const { data } = await api.post<AddToCartResult>('cart/items/', { variant_id: variantId, quantity });
        queryClient.setQueryData(['cart'], data);
        return data;
      }
      const current = await currentLines();
      const existing = current.find((l) => l.variantId === variantId);
      if (!existing && current.length >= GUEST_MAX_LINES) throw new Error('Your cart is full. Remove something first.');
      const have = existing && !existing.saved ? existing.quantity : 0;
      let next = Math.min(have + quantity, 99);
      let limited = false;
      if (knownStock !== undefined && next > knownStock) {
        next = knownStock;
        limited = true;
      }
      const line: GuestLine = { variantId, quantity: Math.max(next, 1), saved: false };
      await saveLines(existing ? current.map((l) => (l.variantId === variantId ? line : l)) : [...current, line]);
      return {
        added: {
          variant_id: variantId,
          quantity: line.quantity,
          limited_by_stock: limited,
          message: limited ? `Only ${knownStock} available, so the quantity was set to ${line.quantity}.` : '',
        },
      };
    },
    [signedIn, queryClient, currentLines, saveLines],
  );

  // A cart line's `id` is the database id for a logged-in shopper and the version's id for a guest.
  const changeGuest = useCallback(
    async (lineId: number, change: (line: GuestLine) => GuestLine | null) => {
      const next: GuestLine[] = [];
      for (const l of await currentLines()) {
        if (l.variantId !== lineId) {
          next.push(l);
          continue;
        }
        const changed = change(l);
        if (changed) next.push(changed);
      }
      await saveLines(next);
    },
    [currentLines, saveLines],
  );

  const setQuantity = useCallback(
    async (lineId: number, quantity: number) => {
      if (signedIn) {
        queryClient.setQueryData(['cart'], (await api.patch<Cart>(`cart/items/${lineId}/`, { quantity })).data);
      } else {
        await changeGuest(lineId, (l) => ({ ...l, quantity }));
      }
    },
    [signedIn, queryClient, changeGuest],
  );

  const removeLine = useCallback(
    async (lineId: number) => {
      if (signedIn) {
        queryClient.setQueryData(['cart'], (await api.delete<Cart>(`cart/items/${lineId}/`)).data);
      } else {
        await changeGuest(lineId, () => null);
      }
    },
    [signedIn, queryClient, changeGuest],
  );

  const saveForLater = useCallback(
    async (lineId: number) => {
      if (signedIn) {
        queryClient.setQueryData(['cart'], (await api.post<Cart>(`cart/items/${lineId}/save/`)).data);
      } else {
        await changeGuest(lineId, (l) => ({ ...l, saved: true }));
      }
    },
    [signedIn, queryClient, changeGuest],
  );

  // A coupon belongs to an account, so only a logged-in shopper has one.
  const applyCoupon = useCallback(
    async (code: string) => {
      queryClient.setQueryData(['cart'], (await api.post<Cart>('cart/coupon/', { code })).data);
    },
    [queryClient],
  );

  const removeCoupon = useCallback(async () => {
    queryClient.setQueryData(['cart'], (await api.delete<Cart>('cart/coupon/')).data);
  }, [queryClient]);

  // Adds several versions one after the other (a whole bundle, or the missing items of a suggestion).
  const addMany = useCallback(
    async (items: { variantId: number; quantity: number }[]) => {
      for (const item of items) await add(item.variantId, item.quantity);
    },
    [add],
  );

  const moveToCart = useCallback(
    async (lineId: number) => {
      if (signedIn) {
        queryClient.setQueryData(['cart'], (await api.delete<Cart>(`cart/items/${lineId}/save/`)).data);
      } else {
        await changeGuest(lineId, (l) => ({ ...l, saved: false }));
      }
    },
    [signedIn, queryClient, changeGuest],
  );

  // ---- what the screens read ----
  const cart: Cart | undefined = signedIn ? server.data : guest ? (lines.length > 0 ? priced.data : EMPTY_CART) : undefined;
  const count = signedIn ? server.data?.count ?? 0 : lines.filter((l) => !l.saved).reduce((sum, l) => sum + l.quantity, 0);
  const source = signedIn ? server : priced;
  const isLoading = signedIn ? server.isLoading : guest ? stored.isLoading || (lines.length > 0 && priced.isLoading) : true;

  return {
    cart,
    count,
    signedIn,
    isLoading,
    isError: signedIn ? server.isError : guest && lines.length > 0 && priced.isError,
    error: source.error,
    refetch: () => (signedIn ? server.refetch() : priced.refetch()),
    add,
    setQuantity,
    removeLine,
    saveForLater,
    moveToCart,
    applyCoupon,
    removeCoupon,
    addMany,
  };
}
