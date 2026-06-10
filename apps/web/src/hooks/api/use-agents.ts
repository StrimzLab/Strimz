'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type {
  AgentActivityLog,
  AgentJob,
  AgentMerchantConfig,
  CreateAgentJobInput,
  UpdateAgentConfigInput,
} from '@strimz/shared-types'

import type { ListActivityParams, ListJobsParams } from '@/lib/merchant-api/resources/agents'
import type { Page } from '@/lib/merchant-api'

import { useMerchantApi } from './merchant-api-context'
import { useMutationWithToast } from './use-mutation-with-toast'
import { agentKeys } from './query-keys'

type ConfigOptions<TData = AgentMerchantConfig> = Omit<
  UseQueryOptions<AgentMerchantConfig, Error, TData, ReturnType<typeof agentKeys.config>>,
  'queryKey' | 'queryFn'
>

type ActivityOptions<TData = Page<AgentActivityLog>> = Omit<
  UseQueryOptions<Page<AgentActivityLog>, Error, TData, ReturnType<typeof agentKeys.activity>>,
  'queryKey' | 'queryFn'
>

type JobsOptions<TData = Page<AgentJob>> = Omit<
  UseQueryOptions<Page<AgentJob>, Error, TData, ReturnType<typeof agentKeys.jobList>>,
  'queryKey' | 'queryFn'
>

type JobOptions<TData = AgentJob> = Omit<
  UseQueryOptions<AgentJob, Error, TData, ReturnType<typeof agentKeys.jobDetail>>,
  'queryKey' | 'queryFn'
>

export function useAgentConfig<TData = AgentMerchantConfig>(options?: ConfigOptions<TData>) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: agentKeys.config(),
    queryFn: ({ signal }) => api.agents.retrieveConfig({ signal }),
    staleTime: 2 * 60_000,
    ...options,
  })
}

export function useUpdateAgentConfig() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: UpdateAgentConfigInput) => api.agents.updateConfig(input),
    onSuccess: (cfg) => {
      qc.setQueryData(agentKeys.config(), cfg)
    },
    messages: {
      loading: 'Saving agent config…',
      success: 'Agent config saved',
    },
  })
}

export function useAgentActivity<TData = Page<AgentActivityLog>>(
  params: ListActivityParams = {},
  options?: ActivityOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: agentKeys.activity(params),
    queryFn: ({ signal }) => api.agents.listActivity(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useAgentJobs<TData = Page<AgentJob>>(
  params: ListJobsParams = {},
  options?: JobsOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: agentKeys.jobList(params),
    queryFn: ({ signal }) => api.agents.listJobs(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useAgentJob<TData = AgentJob>(
  id: string | null | undefined,
  options?: JobOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: agentKeys.jobDetail(id ?? '__unset'),
    queryFn: ({ signal }) => api.agents.retrieveJob(id as string, { signal }),
    enabled: typeof id === 'string' && id.length > 0,
    ...options,
  })
}

export function useCreateAgentJob() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: CreateAgentJobInput) => api.agents.createJob(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.jobs() })
    },
    messages: {
      loading: 'Creating agent job…',
      success: (job) => `Job ${job.id.slice(0, 10)}… created`,
    },
  })
}

export function useApproveAgentJob() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (id: string) => api.agents.approveJob(id),
    onSuccess: (job) => {
      qc.setQueryData(agentKeys.jobDetail(job.id), job)
      qc.invalidateQueries({ queryKey: agentKeys.jobs() })
    },
    messages: {
      loading: 'Approving job…',
      success: 'Job approved',
    },
  })
}
