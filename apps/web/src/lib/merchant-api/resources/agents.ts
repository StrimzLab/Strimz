import type {
  AgentActivityLog,
  AgentJob,
  AgentMerchantConfig,
  CreateAgentJobInput,
  UpdateAgentConfigInput,
} from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions, Page, PaginationParams } from '../types'

export interface ListActivityParams extends PaginationParams {
  capability?: string
  outcome?: string
}

export interface ListJobsParams extends PaginationParams {
  status?: string
}

export class AgentsResource {
  constructor(private readonly client: MerchantApiClient) {}

  retrieveConfig(options?: CallOptions): Promise<AgentMerchantConfig> {
    return this.client.get<AgentMerchantConfig>('/v1/agents/config', options)
  }

  updateConfig(input: UpdateAgentConfigInput, options?: CallOptions): Promise<AgentMerchantConfig> {
    return this.client.patch<AgentMerchantConfig>('/v1/agents/config', input, options)
  }

  listActivity(
    params: ListActivityParams = {},
    options?: CallOptions,
  ): Promise<Page<AgentActivityLog>> {
    return this.client.get<Page<AgentActivityLog>>('/v1/agents/activity', {
      ...options,
      query: {
        cursor: params.cursor,
        limit: params.limit,
        capability: params.capability,
        outcome: params.outcome,
      },
    })
  }

  listJobs(params: ListJobsParams = {}, options?: CallOptions): Promise<Page<AgentJob>> {
    return this.client.get<Page<AgentJob>>('/v1/agents/jobs', {
      ...options,
      query: {
        cursor: params.cursor,
        limit: params.limit,
        status: params.status,
      },
    })
  }

  retrieveJob(id: string, options?: CallOptions): Promise<AgentJob> {
    return this.client.get<AgentJob>(`/v1/agents/jobs/${encodeURIComponent(id)}`, options)
  }

  createJob(input: CreateAgentJobInput, options?: CallOptions): Promise<AgentJob> {
    return this.client.post<AgentJob>('/v1/agents/jobs', input, options)
  }

  approveJob(id: string, options?: CallOptions): Promise<AgentJob> {
    return this.client.post<AgentJob>(
      `/v1/agents/jobs/${encodeURIComponent(id)}/approve`,
      {},
      options,
    )
  }
}
