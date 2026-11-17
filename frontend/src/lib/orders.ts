// The shopper's orders: the list for the Orders tab and one order for its detail page.
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from './api';
import { useAuth } from './auth';
import type { Order, OrderPage } from './types';

export type OrderFilter = 'all' | 'active' | 'delivered';

export function useOrders(filter: OrderFilter) {
  const { status } = useAuth();
  return useInfiniteQuery({
    queryKey: ['orders', filter],
    enabled: status === 'signedIn',
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => (await api.get<OrderPage>('orders/', { params: { filter, page: pageParam } })).data,
    getNextPageParam: (last) => last.next_page ?? undefined,
  });
}

// The payment page stores the confirmed order under the same key, so the page opens instantly after paying.
export function useOrder(id: number) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['order', id],
    enabled: status === 'signedIn' && Number.isFinite(id),
    queryFn: async () => (await api.get<{ order: Order }>(`orders/${id}/`)).data.order,
  });
}
