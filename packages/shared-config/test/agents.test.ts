import { describe, expect, it } from 'vitest'
import { AGENT_CAPABILITIES, type AgentCapability } from '../src/index.js'

describe('agent capability availability', () => {
  it('hides agentic commerce (escrow) for launch', () => {
    expect(AGENT_CAPABILITIES.commerce.available).toBe(false)
  })

  it.each<AgentCapability>(['identity', 'recovery', 'routing', 'cashflow', 'pricing_intelligence'])(
    'leaves %s as it is',
    (id) => {
      expect(AGENT_CAPABILITIES[id].available).toBe(true)
    },
  )
})
