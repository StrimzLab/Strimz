import { describe, it, expect, vi } from 'vitest'
import { AutoPagingIterator } from '../src/pagination.js'

describe('AutoPagingIterator', () => {
  it('walks every page', async () => {
    const fetchPage = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({ data: [1, 2], nextCursor: 'c1', hasMore: true }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ data: [3, 4], nextCursor: 'c2', hasMore: true }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ data: [5], nextCursor: null, hasMore: false }),
      )

    const iter = new AutoPagingIterator(fetchPage)
    const out = await iter.toArray()
    expect(out).toEqual([1, 2, 3, 4, 5])
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  it('forEach awaits async handlers', async () => {
    const fetchPage = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({ data: [1, 2], nextCursor: null, hasMore: false }),
      )
    const iter = new AutoPagingIterator<number>(fetchPage)
    const seen: number[] = []
    await iter.forEach(async (v) => {
      await Promise.resolve()
      seen.push(v)
    })
    expect(seen).toEqual([1, 2])
  })

  it('stops when hasMore is false even with a cursor', async () => {
    const fetchPage = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({ data: [1], nextCursor: 'extra', hasMore: false }),
      )
    const iter = new AutoPagingIterator(fetchPage)
    expect(await iter.toArray()).toEqual([1])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})
