import { describe, expect, it, vi } from 'vitest'
import { PrivyPolicyViolationError, type PrivyWalletApi } from '@strimz/signer'

import { alertOnPolicyRefusal } from '../../src/infra/privy-signer/policy-alert.js'
import { withNonceReset } from '../../src/infra/chain/nonce-reset.js'
import type { EmailService } from '../../src/infra/email/email.service.js'

const request = {
  type: 2 as const,
  chain_id: 5042,
  to: '0x0000000000000000000000000000000000000001',
  data: '0x',
  value: '0x0',
  nonce: 0,
  gas_limit: '0x1',
  max_fee_per_gas: '0x1',
  max_priority_fee_per_gas: '0x1',
}

function api(sign: () => Promise<`0x${string}`>): PrivyWalletApi {
  return { walletAddress: () => Promise.resolve('0x0'), signTransaction: vi.fn(sign) }
}

// ADR-2026-11-22-privy-server-signers.
describe('Privy policy refusals', () => {
  it('emails ops once and still fails the call', async () => {
    const email = { send: vi.fn(() => Promise.resolve()) }
    const guarded = alertOnPolicyRefusal(
      api(() => Promise.reject(new PrivyPolicyViolationError('scheduler-wallet'))),
      email as unknown as EmailService,
      'ops@strimz.test',
    )
    await expect(guarded.signTransaction('scheduler-wallet', request)).rejects.toBeInstanceOf(
      PrivyPolicyViolationError,
    )
    await expect(guarded.signTransaction('scheduler-wallet', request)).rejects.toBeInstanceOf(
      PrivyPolicyViolationError,
    )
    expect(email.send).toHaveBeenCalledTimes(1)
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@strimz.test',
        subject: expect.stringMatching(/Privy refused/u),
      }),
    )
  })

  it('does not email for an ordinary outage', async () => {
    const email = { send: vi.fn(() => Promise.resolve()) }
    const outage = new Error('503')
    const guarded = alertOnPolicyRefusal(
      api(() => Promise.reject(outage)),
      email as unknown as EmailService,
      'ops@strimz.test',
    )
    await expect(guarded.signTransaction('w', request)).rejects.toBe(outage)
    expect(email.send).not.toHaveBeenCalled()
  })
})

describe('nonce reset after a failed send', () => {
  const account = { address: '0x0000000000000000000000000000000000000abc' as const }

  it('forgets the nonce it handed out when the send fails, so the next one has no gap', async () => {
    const nonceManager = { reset: vi.fn() }
    const boom = new Error('signing failed')
    await expect(
      withNonceReset({ ...account, nonceManager }, 5042, () => Promise.reject(boom)),
    ).rejects.toBe(boom)
    expect(nonceManager.reset).toHaveBeenCalledWith({ address: account.address, chainId: 5042 })
  })

  it('leaves the nonce alone when the send succeeds', async () => {
    const nonceManager = { reset: vi.fn() }
    expect(
      await withNonceReset({ ...account, nonceManager }, 5042, () => Promise.resolve('0xhash')),
    ).toBe('0xhash')
    expect(nonceManager.reset).not.toHaveBeenCalled()
  })
})
