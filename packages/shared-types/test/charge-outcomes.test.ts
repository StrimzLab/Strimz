import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { subscriptionChargeOutcomeSchema } from '../src/subscriptions.js'

function prismaEnum(name: string): string[] {
  const schema = readFileSync(
    new URL('../../db/prisma/schema/enums.prisma', import.meta.url),
    'utf8',
  )
  const body = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema)?.[1]
  if (!body) throw new Error(`no enum ${name} in enums.prisma`)
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'))
}

describe('subscription charge outcomes', () => {
  it('match the database enum', () => {
    expect([...subscriptionChargeOutcomeSchema.options]).toEqual(
      prismaEnum('SubscriptionChargeOutcome'),
    )
  })
})
