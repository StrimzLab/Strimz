/**
 * Cursor-based pagination, identical shape to the API's list responses.
 */

export interface Page<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}

export interface PaginationParams {
  limit?: number
  cursor?: string | null
}

/**
 * Async-iterable wrapper that auto-paginates through every page of a list.
 *
 *   for await (const tx of strimz.transactions.listAll()) { ... }
 */
export class AutoPagingIterator<T> implements AsyncIterable<T> {
  constructor(
    private readonly fetchPage: (cursor: string | null) => Promise<Page<T>>,
  ) {}

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let cursor: string | null = null
    let first = true
    while (first || cursor !== null) {
      first = false
      const page: Page<T> = await this.fetchPage(cursor)
      for (const item of page.data) {
        yield item
      }
      cursor = page.hasMore ? page.nextCursor : null
    }
  }

  async forEach(handler: (item: T) => void | Promise<void>): Promise<void> {
    for await (const item of this) {
      await handler(item)
    }
  }

  async toArray(): Promise<T[]> {
    const out: T[] = []
    for await (const item of this) out.push(item)
    return out
  }
}
