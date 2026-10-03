'use client'

import { keepPreviousData, useInfiniteQuery, type QueryKey } from '@tanstack/react-query'

import {
  mergeCursorPages,
  nextCursorOf,
  type LoadedRows,
  type ServerRows,
} from '@/lib/cursor-pages'
import type { Page } from '@/lib/merchant-api'

export function useCursorList<T extends { id: string }, TView>(
  queryKey: QueryKey,
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<Page<T>>,
  options: { select: (loaded: LoadedRows<T>) => TView },
) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: nextCursorOf,
    select: (data) => options.select(mergeCursorPages(data.pages)),
    placeholderData: keepPreviousData,
  })
}

export function serverRowsOf(query: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  error: Error | null
  fetchNextPage: () => unknown
}): ServerRows {
  return {
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMoreError: query.isFetchNextPageError
      ? `Couldn't load more: ${query.error?.message ?? 'request failed'}`
      : null,
    onLoadMore: () => void query.fetchNextPage(),
  }
}
