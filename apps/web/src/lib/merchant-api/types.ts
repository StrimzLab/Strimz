/**
 * Cross-resource types for the merchant API client.
 *
 * Keeps the resource modules small — each one re-exports the entity it
 * owns and pulls shared shapes (pagination, common params) from here.
 */

/** Cursor-paginated page envelope returned by every `list` endpoint. */
export interface Page<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}

/** Standard pagination params accepted by every list endpoint. */
export interface PaginationParams {
  /** Cursor token returned by the previous page; `null` for first page. */
  cursor?: string | null
  /** Page size. apps/api clamps to a max (currently 100). */
  limit?: number
}

/**
 * Optional caller-side opts forwarded to the client's RequestOptions.
 * Resource methods don't need timeouts most of the time, but anything
 * that wraps a long-running export should plumb this through.
 */
export interface CallOptions {
  signal?: AbortSignal
  timeoutMs?: number
}
