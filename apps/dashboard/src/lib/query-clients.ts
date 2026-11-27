import { QueryClient } from '@tanstack/react-query'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
}

/**
 * The build's own network keeps one cache for the whole visit: sign-in, the account gate and
 * that mode's pages share it. Test mode on a live build gets a fresh one each time.
 */
export const primaryQueryClient = createQueryClient()
