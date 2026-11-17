// The shopper's notifications and the unread count on the Home bell.
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { api } from './api';
import { useAuth } from './auth';
import type { AppNotification, NotificationPage } from './types';

// Just the number for the bell. Checked again every minute while the app is open.
export function useUnreadCount() {
  const { status } = useAuth();
  const query = useQuery({
    queryKey: ['notifications-unread'],
    enabled: status === 'signedIn',
    refetchInterval: 60_000,
    queryFn: async () => (await api.get<{ unread_count: number }>('notifications/unread-count/')).data.unread_count,
  });
  return status === 'signedIn' ? (query.data ?? 0) : 0;
}

export function useNotifications() {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const signedIn = status === 'signedIn';

  const query = useInfiniteQuery({
    queryKey: ['notifications'],
    enabled: signedIn,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => (await api.get<NotificationPage>('notifications/', { params: { page: pageParam } })).data,
    getNextPageParam: (last) => last.next_page ?? undefined,
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }),
    ]);
  }, [queryClient]);

  const markRead = useCallback(
    async (n: AppNotification) => {
      if (n.is_read) return;
      await api.post(`notifications/${n.id}/read/`);
      await refreshAll();
    },
    [refreshAll],
  );

  const markAllRead = useCallback(async () => {
    await api.post('notifications/read-all/');
    await refreshAll();
  }, [refreshAll]);

  const items = query.data?.pages.flatMap((p) => p.results) ?? [];
  const unread = query.data?.pages[0]?.unread_count ?? 0;

  return { ...query, signedIn, items, unread, markRead, markAllRead };
}
