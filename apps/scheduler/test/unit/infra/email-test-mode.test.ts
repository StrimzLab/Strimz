import { beforeEach, describe, expect, it, vi } from 'vitest'

const sent: Array<Record<string, unknown>> = []
vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: (payload: Record<string, unknown>) => {
        sent.push(payload)
        return Promise.resolve({ data: { id: 'em_1' }, error: null })
      },
    }
  },
}))

const { EmailService } = await import('../../../src/infra/email/email.service.js')

function service(environment: 'testnet' | 'mainnet') {
  const env = {
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'Strimz <noreply@mail.strimz.finance>',
    RESEND_REPLY_TO: 'support@strimz.finance',
    ARC_ENVIRONMENT: environment,
  }
  return new EmailService({ env } as never)
}

// ADR-2026-11-26-test-mode: every test-mode email says so.
describe('EmailService in test mode', () => {
  beforeEach(() => {
    sent.length = 0
  })

  it('labels emails sent from testnet', async () => {
    await service('testnet').send({ to: 'a@b.co', subject: 'Welcome', html: '<p>Hi</p>' })
    expect(sent[0]?.subject).toBe('[Test] Welcome')
    expect(String(sent[0]?.html)).toMatch(/no real money/iu)
  })

  it('sends mainnet emails unchanged', async () => {
    await service('mainnet').send({ to: 'a@b.co', subject: 'Welcome', html: '<p>Hi</p>' })
    expect(sent[0]?.subject).toBe('Welcome')
    expect(sent[0]?.html).toBe('<p>Hi</p>')
  })
})
