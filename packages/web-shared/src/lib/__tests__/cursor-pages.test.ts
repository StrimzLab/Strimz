import { describe, expect, it } from 'vitest'
import { mergeCursorPages, nextCursorOf, patchListCacheRow } from '../cursor-pages'

type Row = { id: string; status: string }

const page = (ids: string[], nextCursor: string | null) => ({
  data: ids.map((id) => ({ id, status: 'open' })),
  nextCursor,
  hasMore: nextCursor !== null,
})

describe('nextCursorOf', () => {
  it('returns the cursor while the server has more rows', () => {
    expect(nextCursorOf(page(['a'], 'c1'))).toBe('c1')
  })

  it('stops when the server has no more rows', () => {
    expect(nextCursorOf(page(['a'], null))).toBeUndefined()
    expect(nextCursorOf({ data: [], nextCursor: 'c1', hasMore: false })).toBeUndefined()
  })
})

describe('mergeCursorPages', () => {
  it('joins every loaded page in order and reports whether more exist', () => {
    const merged = mergeCursorPages([page(['a', 'b'], 'c1'), page(['c'], 'c2')])
    expect(merged.rows.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(merged.hasMore).toBe(true)
  })

  it('drops a row repeated across pages when rows shift between requests', () => {
    const merged = mergeCursorPages([page(['a', 'b'], 'c1'), page(['b', 'c'], null)])
    expect(merged.rows.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(merged.hasMore).toBe(false)
  })

  it('handles no pages', () => {
    expect(mergeCursorPages<Row>([])).toEqual({ rows: [], hasMore: false })
  })
})

describe('patchListCacheRow', () => {
  const close = (r: Row): Row => ({ ...r, status: 'closed' })

  it('patches the row in a single page cache', () => {
    const next = patchListCacheRow(page(['a', 'b'], null), 'b', close)
    expect(next && 'data' in next ? next.data.map((r) => r.status) : null).toEqual([
      'open',
      'closed',
    ])
  })

  it('patches the row in a multi page cache', () => {
    const cache = { pages: [page(['a'], 'c1'), page(['b'], null)], pageParams: [null, 'c1'] }
    const next = patchListCacheRow(cache, 'b', close)
    expect(next && 'pages' in next ? next.pages[1]?.data[0]?.status : null).toBe('closed')
    expect(next && 'pages' in next ? next.pageParams : null).toEqual([null, 'c1'])
  })

  it('returns undefined when the row is not in the cache', () => {
    expect(patchListCacheRow(page(['a'], null), 'z', close)).toBeUndefined()
    expect(patchListCacheRow(undefined, 'a', close)).toBeUndefined()
  })
})
