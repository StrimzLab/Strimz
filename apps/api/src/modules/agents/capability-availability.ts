import { ForbiddenException } from '@nestjs/common'
import { AGENT_CAPABILITIES, type AgentCapability } from '@strimz/shared-config'

export function assertCapabilityAvailable(capability: AgentCapability): void {
  if (AGENT_CAPABILITIES[capability].available) return
  throw new ForbiddenException({
    code: 'capability_unavailable',
    message: `${AGENT_CAPABILITIES[capability].name} is not available yet`,
    details: { capability },
  })
}

export function assertNewCapabilitiesAvailable(
  stored: readonly AgentCapability[],
  requested: readonly AgentCapability[] | undefined,
): void {
  for (const capability of requested ?? []) {
    if (!stored.includes(capability)) assertCapabilityAvailable(capability)
  }
}
