'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MarkNotificationsReadResponse, NotificationListResponse } from '@strimz/shared-types'

import { useMerchantApi } from './merchant-api-context'

/** Query-key factory kept alongside the hook. No other file consumes it. */
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (limit: number) => [...notificationKeys.all, 'list', limit] as const,
}

/**
 * Polls the notifications endpoint. The endpoint is cheap (three
 * indexed queries, capped at 30 rows each), so a 30-second stale time
 * + 30-second refetch interval keeps the bell responsive without
 * beating up the API.
 */
export function useNotifications(limit = 20) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: notificationKeys.list(limit),
    queryFn: ({ signal }) => api.notifications.list(limit, { signal }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

/**
 * Marks all notifications read. The mutation optimistically flips
 * `unreadCount → 0` + every item's `read → true` so the badge and pip
 * markers clear instantly; the invalidation on success bumps the real
 * response back in and unwinds the optimistic state if the server
 * disagreed for any reason.
 */
export function useMarkNotificationsRead() {
  const api = useMerchantApi()
  const qc = useQueryClient()

  return useMutation<MarkNotificationsReadResponse, Error, void>({
    mutationFn: () => api.notifications.markAllRead(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.all })
      const previous = qc.getQueriesData<NotificationListResponse>({
        queryKey: notificationKeys.all,
      })
      const now = new Date().toISOString()
      for (const [key, data] of previous) {
        if (!data) continue
        qc.setQueryData<NotificationListResponse>(key, {
          data: data.data.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
          lastReadAt: now,
        })
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      const previous = (
        ctx as { previous?: [readonly unknown[], NotificationListResponse | undefined][] }
      )?.previous
      if (!previous) return
      for (const [key, data] of previous) {
        qc.setQueryData(key, data)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
