import type { Page } from './merchant-api'

export interface LoadedRows<T> {
  rows: T[]
  hasMore: boolean
}

export interface InfinitePages<T> {
  pages: Page<T>[]
  pageParams: unknown[]
}

export interface ServerRows {
  hasMore: boolean
  loadingMore: boolean
  loadMoreError: string | null
  onLoadMore: () => void
}

export type ListCache<T> = Page<T> | InfinitePages<T>

export function nextCursorOf<T>(page: Page<T>): string | undefined {
  return page.hasMore && page.nextCursor ? page.nextCursor : undefined
}

export function mergeCursorPages<T extends { id: string }>(
  pages: readonly Page<T>[],
): LoadedRows<T> {
  const seen = new Set<string>()
  const rows: T[] = []
  for (const page of pages) {
    for (const row of page.data) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      rows.push(row)
    }
  }
  const last = pages[pages.length - 1]
  return { rows, hasMore: last ? nextCursorOf(last) !== undefined : false }
}

function patchPage<T extends { id: string }>(
  page: Page<T>,
  id: string,
  patch: (row: T) => T,
): Page<T> | undefined {
  const index = page.data.findIndex((row) => row.id === id)
  const target = page.data[index]
  if (!target) return undefined
  const data = [...page.data]
  data[index] = patch(target)
  return { ...page, data }
}

export function patchListCacheRow<T extends { id: string }>(
  cache: ListCache<T> | undefined,
  id: string,
  patch: (row: T) => T,
): ListCache<T> | undefined {
  if (!cache) return undefined
  if ('pages' in cache) {
    let changed = false
    const pages = cache.pages.map((page) => {
      const next = patchPage(page, id, patch)
      if (!next) return page
      changed = true
      return next
    })
    return changed ? { ...cache, pages } : undefined
  }
  return patchPage(cache, id, patch)
}
