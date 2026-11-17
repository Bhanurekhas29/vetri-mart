// TanStack Query remembers data from the server, so screens show it instantly and refresh quietly.
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000, // data counts as fresh for 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});
