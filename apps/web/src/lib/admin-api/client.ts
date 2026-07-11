import { env } from '@/lib/env'
import { type AccessTokenProvider, defaultAccessTokenProvider } from '@/lib/merchant-api/auth-token'
import { buildApiError, type ApiErrorBody, AuthenticationError } from '@/lib/merchant-api/errors'

import type {
  AdminMerchantDetail,
  AdminMerchantListResponse,
  AdminProfile,
  AdminListItem,
  Broadcast,
  BroadcastAudience,
  BroadcastListResponse,
  CreateBroadcastInput,
  HealthResponse,
  InviteAdminInput,
  PlatformOverview,
  SetAdminRoleInput,
  SetAdminStatusInput,
  SetMerchantStatusInput,
  SetMerchantTierInput,
  SignupSeriesResponse,
  TopMerchantsResponse,
  VolumeSeriesResponse,
} from './types'

/**
 * Admin API client. Mirrors `MerchantApiClient`'s shape but talks to
 * `/v1/admin/*` and the `apps/web` BFF routes at `/api/admin/*`.
 *
 * Architectural split:
 *   - **Reads** call `${env.apiUrl}/v1/admin/*` directly, attaching the
 *     admin's Privy access token. Same pattern as the merchant client.
 *   - **Writes** route through `/api/admin/*` BFF in Next, so admin
 *     mutations get server-side CSRF + audit context. The BFF
 *     re-forwards to `/v1/admin/*` with the same token plus internal
 *     headers it adds server-side.
 *
 * The split is justified per the conversation: writes deserve a
 * controlled gateway (audit, CSRF, ability to inject internal
 * credentials later); reads don't really benefit from the extra hop.
 */

interface RequestOptions {
  signal?: AbortSignal
  query?: Record<string, string | number | undefined | null>
  body?: unknown
}

export class AdminApiClient {
  private readonly apiBaseUrl: string
  /** Origin of this app. Used for the BFF base. Set at module load. */
  private readonly bffBaseUrl: string
  private readonly getAccessToken: AccessTokenProvider
  private readonly defaultTimeoutMs = 30_000

  constructor(opts: { getAccessToken?: AccessTokenProvider; bffBaseUrl?: string } = {}) {
    this.apiBaseUrl = env.apiUrl.replace(/\/+$/, '')
    this.bffBaseUrl = (opts.bffBaseUrl ?? '').replace(/\/+$/, '')
    this.getAccessToken = opts.getAccessToken ?? defaultAccessTokenProvider
  }

  // ----- Reads (direct to /v1/admin/*) -----
  me = (options?: RequestOptions) => this.directGet<AdminProfile>('/v1/admin/me', options)
  overview = (options?: RequestOptions) =>
    this.directGet<PlatformOverview>('/v1/admin/overview', options)
  listMerchants = (
    params: {
      status?: string
      tier?: string
      query?: string
      limit?: number
      cursor?: string | null
    } = {},
    options?: RequestOptions,
  ) =>
    this.directGet<AdminMerchantListResponse>('/v1/admin/merchants', {
      ...options,
      query: {
        status: params.status,
        tier: params.tier,
        query: params.query,
        limit: params.limit,
        cursor: params.cursor ?? undefined,
      },
    })
  getMerchant = (id: string, options?: RequestOptions) =>
    this.directGet<AdminMerchantDetail>(`/v1/admin/merchants/${encodeURIComponent(id)}`, options)
  volumeSeries = (range: { from?: string; to?: string } = {}, options?: RequestOptions) =>
    this.directGet<VolumeSeriesResponse>('/v1/admin/analytics/volume', { ...options, query: range })
  signupSeries = (range: { from?: string; to?: string } = {}, options?: RequestOptions) =>
    this.directGet<SignupSeriesResponse>('/v1/admin/analytics/signups', {
      ...options,
      query: range,
    })
  topMerchants = (limit = 10, options?: RequestOptions) =>
    this.directGet<TopMerchantsResponse>('/v1/admin/analytics/top-merchants', {
      ...options,
      query: { limit },
    })
  health = (options?: RequestOptions) => this.directGet<HealthResponse>('/v1/admin/health', options)
  listAdmins = (options?: RequestOptions) =>
    this.directGet<{ data: AdminListItem[] }>('/v1/admin/admins', options)

  // ----- Writes (through BFF) -----
  suspendMerchant = (id: string) =>
    this.bff<AdminMerchantDetail>(`/api/admin/merchants/${encodeURIComponent(id)}/suspend`, {})
  reactivateMerchant = (id: string) =>
    this.bff<AdminMerchantDetail>(`/api/admin/merchants/${encodeURIComponent(id)}/reactivate`, {})
  closeMerchant = (id: string) =>
    this.bff<AdminMerchantDetail>(`/api/admin/merchants/${encodeURIComponent(id)}/close`, {})
  setMerchantStatus = (id: string, input: SetMerchantStatusInput) =>
    this.bffPatch<AdminMerchantDetail>(
      `/api/admin/merchants/${encodeURIComponent(id)}/status`,
      input,
    )
  setMerchantTier = (id: string, input: SetMerchantTierInput) =>
    this.bffPatch<AdminMerchantDetail>(`/api/admin/merchants/${encodeURIComponent(id)}/tier`, input)

  inviteAdmin = (input: InviteAdminInput) => this.bff<AdminListItem>('/api/admin/admins', input)
  setAdminRole = (id: string, input: SetAdminRoleInput) =>
    this.bffPatch<AdminListItem>(`/api/admin/admins/${encodeURIComponent(id)}/role`, input)
  setAdminStatus = (id: string, input: SetAdminStatusInput) =>
    this.bffPatch<AdminListItem>(`/api/admin/admins/${encodeURIComponent(id)}/status`, input)
  removeAdmin = (id: string) =>
    this.bffDelete<AdminListItem>(`/api/admin/admins/${encodeURIComponent(id)}`)

  // ----- Broadcasts -----
  listBroadcasts = (
    params: { audience?: BroadcastAudience; limit?: number } = {},
    options?: RequestOptions,
  ) => {
    const search = new URLSearchParams()
    if (params.audience) search.set('audience', params.audience)
    if (params.limit !== undefined) search.set('limit', String(params.limit))
    const query = search.toString()
    return this.directGet<BroadcastListResponse>(
      `/v1/admin/broadcasts${query ? `?${query}` : ''}`,
      options,
    )
  }
  createBroadcast = (input: CreateBroadcastInput) =>
    this.bff<Broadcast>('/api/admin/broadcasts', input)

  // ------------------------------------------------------------------

  private async directGet<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', this.apiBaseUrl + path, options, /* useBearer */ true)
  }

  private async bff<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', this.bffBaseUrl + path, { body }, false)
  }
  private async bffPatch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', this.bffBaseUrl + path, { body }, false)
  }
  private async bffDelete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', this.bffBaseUrl + path, undefined, false)
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    options: RequestOptions | undefined,
    useBearer: boolean,
  ): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (useBearer) {
      const token = await this.getAccessToken()
      if (!token) {
        throw new AuthenticationError({
          code: 'authentication_error',
          message: 'no Privy access token available. Sign in to continue',
        })
      }
      headers.authorization = `Bearer ${token}`
    }

    let bodyJson: string | undefined
    if (options?.body !== undefined) {
      bodyJson = JSON.stringify(options.body)
      headers['content-type'] = 'application/json'
    }

    const finalUrl = new URL(url)
    if (options?.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v === undefined || v === null || v === '') continue
        finalUrl.searchParams.set(k, String(v))
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeoutMs)
    options?.signal?.addEventListener('abort', () => controller.abort(), { once: true })

    let response: Response
    try {
      response = await fetch(finalUrl, {
        method,
        headers,
        body: bodyJson,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (response.status === 204) return undefined as T

    const isJson = response.headers.get('content-type')?.includes('application/json')
    if (!response.ok) {
      const body: ApiErrorBody = isJson
        ? await response.json().catch(() => ({ code: 'unknown_error', message: 'failed' }))
        : { code: 'unknown_error', message: 'failed' }
      throw buildApiError(response.status, body, response.headers)
    }
    if (!isJson) throw new Error('expected JSON response')
    return (await response.json()) as T
  }
}
