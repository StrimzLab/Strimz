/**
 * Base class every resource extends. Centralises endpoint plumbing so
 * resource classes are tiny declarative wrappers.
 */

import type { z } from 'zod'
import type { Fetcher, RequestSpec } from '../http/fetcher.js'
import { generateIdempotencyKey } from '../idempotency.js'
import { AutoPagingIterator, type Page, type PaginationParams } from '../pagination.js'

type AnySchema = z.ZodTypeAny
type Inferred<S extends AnySchema> = z.output<S>

export interface ResourceContext {
  fetcher: Fetcher
}

export interface RequestOptions {
  /** Override or supply the idempotency key for a mutating call. */
  idempotencyKey?: string
  /** Per-request timeout in ms. */
  timeoutMs?: number
}

export abstract class BaseResource {
  constructor(protected readonly ctx: ResourceContext) {}

  protected async get<S extends AnySchema>(
    path: string,
    schema?: S,
    query?: RequestSpec['query'],
  ): Promise<Inferred<S>> {
    const data = await this.ctx.fetcher.request<unknown>({ method: 'GET', path, query })
    return parse(data, schema)
  }

  protected async post<S extends AnySchema>(
    path: string,
    body: unknown,
    schema?: S,
    options?: RequestOptions,
  ): Promise<Inferred<S>> {
    const data = await this.ctx.fetcher.request<unknown>({
      method: 'POST',
      path,
      body,
      idempotencyKey: options?.idempotencyKey ?? generateIdempotencyKey(),
      timeoutMs: options?.timeoutMs,
    })
    return parse(data, schema)
  }

  protected async patch<S extends AnySchema>(
    path: string,
    body: unknown,
    schema?: S,
    options?: RequestOptions,
  ): Promise<Inferred<S>> {
    const data = await this.ctx.fetcher.request<unknown>({
      method: 'PATCH',
      path,
      body,
      idempotencyKey: options?.idempotencyKey ?? generateIdempotencyKey(),
      timeoutMs: options?.timeoutMs,
    })
    return parse(data, schema)
  }

  protected async delete<S extends AnySchema>(path: string, schema?: S): Promise<Inferred<S>> {
    const data = await this.ctx.fetcher.request<unknown>({ method: 'DELETE', path })
    return parse(data, schema)
  }

  protected listPage<S extends AnySchema>(
    path: string,
    itemSchema: S,
    params?: PaginationParams | Record<string, ScalarParam>,
  ): Promise<Page<Inferred<S>>> {
    return this.ctx.fetcher
      .request<unknown>({ method: 'GET', path, query: toQuery(params) })
      .then((raw) => parsePage(raw, itemSchema))
  }

  protected listAuto<S extends AnySchema>(
    path: string,
    itemSchema: S,
    params?: Record<string, ScalarParam>,
  ): AutoPagingIterator<Inferred<S>> {
    return new AutoPagingIterator((cursor) =>
      this.listPage(path, itemSchema, { ...params, cursor }),
    )
  }
}

type ScalarParam = string | number | boolean | null | undefined

function toQuery(
  params: PaginationParams | Record<string, ScalarParam> | undefined,
): Record<string, ScalarParam> {
  if (!params) return {}
  return params as Record<string, ScalarParam>
}

function parse<S extends AnySchema>(data: unknown, schema?: S): Inferred<S> {
  return (schema ? schema.parse(data) : data) as Inferred<S>
}

function parsePage<S extends AnySchema>(raw: unknown, itemSchema: S): Page<Inferred<S>> {
  const obj = raw as { data?: unknown[]; nextCursor?: string | null; hasMore?: boolean }
  const items = (obj?.data ?? []).map((d) => itemSchema.parse(d) as Inferred<S>)
  return {
    data: items,
    nextCursor: obj?.nextCursor ?? null,
    hasMore: obj?.hasMore === true,
  }
}
