'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'

import { useMutationWithToast } from '@/hooks/api/use-mutation-with-toast'
import type {
  Broadcast,
  BroadcastAudience,
  BroadcastListResponse,
  CreateBroadcastInput,
} from '@strimz/shared-types'
import type {
  AdminListItem,
  AdminMerchantDetail,
  AdminMerchantListResponse,
  AdminProfile,
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
} from '@/lib/admin-api'

import { useAdminApi } from './admin-context'

export { AdminApiProvider, useAdminApi } from './admin-context'

// Query key factories.
export const adminKeys = {
  all: ['admin'] as const,
  me: () => [...adminKeys.all, 'me'] as const,
  overview: () => [...adminKeys.all, 'overview'] as const,
  merchants: () => [...adminKeys.all, 'merchants'] as const,
  merchantList: (params: unknown) => [...adminKeys.merchants(), 'list', params] as const,
  merchantDetail: (id: string) => [...adminKeys.merchants(), 'detail', id] as const,
  analytics: () => [...adminKeys.all, 'analytics'] as const,
  volume: (range: unknown) => [...adminKeys.analytics(), 'volume', range] as const,
  signups: (range: unknown) => [...adminKeys.analytics(), 'signups', range] as const,
  topMerchants: (limit: number) => [...adminKeys.analytics(), 'top', limit] as const,
  health: () => [...adminKeys.all, 'health'] as const,
  admins: () => [...adminKeys.all, 'admins'] as const,
  broadcasts: (audience?: BroadcastAudience) =>
    [...adminKeys.all, 'broadcasts', audience ?? 'any'] as const,
}

// ---- Queries ----

export function useAdminMe<TData = AdminProfile>(
  options?: Omit<
    UseQueryOptions<AdminProfile, Error, TData, ReturnType<typeof adminKeys.me>>,
    'queryKey' | 'queryFn'
  >,
) {
  const api = useAdminApi()
  return useQuery({
    queryKey: adminKeys.me(),
    queryFn: ({ signal }) => api.me({ signal }),
    staleTime: 5 * 60_000,
    retry: false,
    ...options,
  })
}

export function useAdminOverview<TData = PlatformOverview>(
  options?: Omit<
    UseQueryOptions<PlatformOverview, Error, TData, ReturnType<typeof adminKeys.overview>>,
    'queryKey' | 'queryFn'
  >,
) {
  const api = useAdminApi()
  return useQuery({
    queryKey: adminKeys.overview(),
    queryFn: ({ signal }) => api.overview({ signal }),
    staleTime: 60_000,
    ...options,
  })
}

export function useAdminMerchants<TData = AdminMerchantListResponse>(
  params: {
    status?: string
    tier?: string
    query?: string
    limit?: number
    cursor?: string | null
  } = {},
  options?: Omit<
    UseQueryOptions<
      AdminMerchantListResponse,
      Error,
      TData,
      ReturnType<typeof adminKeys.merchantList>
    >,
    'queryKey' | 'queryFn'
  >,
) {
  const api = useAdminApi()
  return useQuery({
    queryKey: adminKeys.merchantList(params),
    queryFn: ({ signal }) => api.listMerchants(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useAdminMerchantDetail<TData = AdminMerchantDetail>(
  id: string | undefined | null,
  options?: Omit<
    UseQueryOptions<AdminMerchantDetail, Error, TData, ReturnType<typeof adminKeys.merchantDetail>>,
    'queryKey' | 'queryFn'
  >,
) {
  const api = useAdminApi()
  return useQuery({
    queryKey: adminKeys.merchantDetail(id ?? '__unset'),
    queryFn: ({ signal }) => api.getMerchant(id as string, { signal }),
    enabled: typeof id === 'string' && id.length > 0,
    ...options,
  })
}

export function useAdminVolume<TData = VolumeSeriesResponse>(
  range: { from?: string; to?: string } = {},
  options?: Omit<
    UseQueryOptions<VolumeSeriesResponse, Error, TData, ReturnType<typeof adminKeys.volume>>,
    'queryKey' | 'queryFn'
  >,
) {
  const api = useAdminApi()
  return useQuery({
    queryKey: adminKeys.volume(range),
    queryFn: ({ signal }) => api.volumeSeries(range, { signal }),
    staleTime: 5 * 60_000,
    ...options,
  })
}

export function useAdminSignups<TData = SignupSeriesResponse>(
  range: { from?: string; to?: string } = {},
  options?: Omit<
    UseQueryOptions<SignupSeriesResponse, Error, TData, ReturnType<typeof adminKeys.signups>>,
    'queryKey' | 'queryFn'
  >,
) {
  const api = useAdminApi()
  return useQuery({
    queryKey: adminKeys.signups(range),
    queryFn: ({ signal }) => api.signupSeries(range, { signal }),
    staleTime: 5 * 60_000,
    ...options,
  })
}

export function useAdminTopMerchants<TData = TopMerchantsResponse>(
  limit = 10,
  options?: Omit<
    UseQueryOptions<TopMerchantsResponse, Error, TData, ReturnType<typeof adminKeys.topMerchants>>,
    'queryKey' | 'queryFn'
  >,
) {
  const api = useAdminApi()
  return useQuery({
    queryKey: adminKeys.topMerchants(limit),
    queryFn: ({ signal }) => api.topMerchants(limit, { signal }),
    staleTime: 5 * 60_000,
    ...options,
  })
}

export function useAdminHealth<TData = HealthResponse>(
  options?: Omit<
    UseQueryOptions<HealthResponse, Error, TData, ReturnType<typeof adminKeys.health>>,
    'queryKey' | 'queryFn'
  >,
) {
  const api = useAdminApi()
  return useQuery({
    queryKey: adminKeys.health(),
    queryFn: ({ signal }) => api.health({ signal }),
    refetchInterval: 30_000,
    ...options,
  })
}

export function useAdminList<TData = { data: AdminListItem[] }>(
  options?: Omit<
    UseQueryOptions<{ data: AdminListItem[] }, Error, TData, ReturnType<typeof adminKeys.admins>>,
    'queryKey' | 'queryFn'
  >,
) {
  const api = useAdminApi()
  return useQuery({
    queryKey: adminKeys.admins(),
    queryFn: ({ signal }) => api.listAdmins({ signal }),
    ...options,
  })
}

// ---- Mutations (BFF-routed) ----

export function useSuspendMerchant() {
  const api = useAdminApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (id: string) => api.suspendMerchant(id),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: adminKeys.merchantDetail(updated.id) })
      qc.invalidateQueries({ queryKey: adminKeys.merchants() })
      qc.invalidateQueries({ queryKey: adminKeys.overview() })
    },
    messages: { loading: 'Suspending merchant…', success: 'Merchant suspended' },
  })
}

export function useReactivateMerchant() {
  const api = useAdminApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (id: string) => api.reactivateMerchant(id),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: adminKeys.merchantDetail(updated.id) })
      qc.invalidateQueries({ queryKey: adminKeys.merchants() })
      qc.invalidateQueries({ queryKey: adminKeys.overview() })
    },
    messages: { loading: 'Reactivating merchant…', success: 'Merchant reactivated' },
  })
}

export function useSetMerchantTier() {
  const api = useAdminApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (vars: { id: string; input: SetMerchantTierInput }) =>
      api.setMerchantTier(vars.id, vars.input),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: adminKeys.merchantDetail(updated.id) })
      qc.invalidateQueries({ queryKey: adminKeys.merchants() })
    },
    messages: { loading: 'Changing tier…', success: (m) => `Tier set to ${m.tier}` },
  })
}

export function useSetMerchantStatus() {
  const api = useAdminApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (vars: { id: string; input: SetMerchantStatusInput }) =>
      api.setMerchantStatus(vars.id, vars.input),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: adminKeys.merchantDetail(updated.id) })
      qc.invalidateQueries({ queryKey: adminKeys.merchants() })
      qc.invalidateQueries({ queryKey: adminKeys.overview() })
    },
    messages: { loading: 'Updating status…', success: (m) => `Status set to ${m.status}` },
  })
}

export function useInviteAdmin() {
  const api = useAdminApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: InviteAdminInput) => api.inviteAdmin(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.admins() }),
    messages: {
      loading: 'Inviting admin…',
      success: (a) => `Invited ${a.email}`,
    },
  })
}

export function useSetAdminRole() {
  const api = useAdminApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (vars: { id: string; input: SetAdminRoleInput }) =>
      api.setAdminRole(vars.id, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.admins() }),
    messages: { loading: 'Updating role…', success: 'Role updated' },
  })
}

export function useSetAdminStatus() {
  const api = useAdminApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (vars: { id: string; input: SetAdminStatusInput }) =>
      api.setAdminStatus(vars.id, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.admins() }),
    messages: { loading: 'Updating admin…', success: 'Admin updated' },
  })
}

export function useRemoveAdmin() {
  const api = useAdminApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (id: string) => api.removeAdmin(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.admins() }),
    messages: { loading: 'Removing admin…', success: 'Admin removed' },
  })
}

// ---- Broadcasts ----

export function useAdminBroadcasts<TData = BroadcastListResponse>(
  params: { audience?: BroadcastAudience; limit?: number } = {},
  options?: Omit<
    UseQueryOptions<BroadcastListResponse, Error, TData, ReturnType<typeof adminKeys.broadcasts>>,
    'queryKey' | 'queryFn'
  >,
) {
  const api = useAdminApi()
  return useQuery({
    queryKey: adminKeys.broadcasts(params.audience),
    queryFn: ({ signal }) => api.listBroadcasts(params, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    ...options,
  })
}

export function useCreateBroadcast() {
  const api = useAdminApi()
  const qc = useQueryClient()
  return useMutationWithToast<Broadcast, CreateBroadcastInput>({
    mutationFn: (input) => api.createBroadcast(input),
    onSuccess: () => {
      // Invalidate every audience slice so the operator sees their
      // new broadcast in whichever tab they're viewing.
      qc.invalidateQueries({ queryKey: [...adminKeys.all, 'broadcasts'] })
    },
    messages: { loading: 'Sending broadcast…', success: 'Broadcast sent' },
  })
}
