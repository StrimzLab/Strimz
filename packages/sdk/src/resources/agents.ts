import {
  agentMerchantConfigSchema,
  updateAgentConfigInputSchema,
  agentActivityLogSchema,
  agentJobSchema,
  createAgentJobInputSchema,
  type AgentMerchantConfig,
  type UpdateAgentConfigInput,
  type AgentActivityLog,
  type AgentJob,
  type CreateAgentJobInput,
} from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class AgentsResource extends BaseResource {
  /** Retrieve the merchant's AutoPay Agent config. */
  retrieveConfig(): Promise<AgentMerchantConfig> {
    return this.get('/v1/agents/config', agentMerchantConfigSchema)
  }

  updateConfig(input: UpdateAgentConfigInput, options?: RequestOptions): Promise<AgentMerchantConfig> {
    updateAgentConfigInputSchema.parse(input)
    return this.patch('/v1/agents/config', input, agentMerchantConfigSchema, options)
  }

  listActivity(
    params?: PaginationParams & { capability?: string; outcome?: string; from?: string; to?: string },
  ): Promise<Page<AgentActivityLog>> {
    return this.listPage('/v1/agents/activity', agentActivityLogSchema, params)
  }

  // ----- ERC-8183 jobs -----

  listJobs(params?: PaginationParams & { status?: string }): Promise<Page<AgentJob>> {
    return this.listPage('/v1/agents/jobs', agentJobSchema, params)
  }

  retrieveJob(id: string): Promise<AgentJob> {
    return this.get(`/v1/agents/jobs/${encodeURIComponent(id)}`, agentJobSchema)
  }

  createJob(input: CreateAgentJobInput, options?: RequestOptions): Promise<AgentJob> {
    createAgentJobInputSchema.parse(input)
    return this.post('/v1/agents/jobs', input, agentJobSchema, options)
  }

  approveJob(id: string, options?: RequestOptions): Promise<AgentJob> {
    return this.post(`/v1/agents/jobs/${encodeURIComponent(id)}/approve`, {}, agentJobSchema, options)
  }
}
