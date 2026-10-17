import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { StrimzClient } from '@strimz/sdk'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant, seedTransaction } from '../helpers/fixtures.js'
import { injectFetch } from '../helpers/inject-fetch.js'

const TX_HASH = `0x${'a'.repeat(64)}`

describe('sdk refunds against the API', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
  })

  it('creates, signs and retrieves a refund through the SDK', async () => {
    const m = await seedMerchant(t.prisma.db)
    const tx = await seedTransaction(t.prisma.db, m.id, { amount: '100000000' })
    const k = await seedApiKey(t.prisma.db, m.id)
    const strimz = new StrimzClient({
      apiKey: k.secretKey,
      baseUrl: 'http://api.test',
      maxRetries: 0,
      fetch: injectFetch(t),
    })

    const { refund, signingInstructions } = await strimz.refunds.create({
      transactionId: tx.id,
      amount: '40000000',
      reason: 'customer_request',
    })
    expect(refund.status).toBe('awaiting_signature')
    expect(signingInstructions.to).toBe(tx.payerAddress)
    expect(signingInstructions.amount).toBe('40000000')

    const submitted = await strimz.refunds.submitSignature({
      id: refund.id,
      refundTxHash: TX_HASH,
    })
    expect(submitted.status).toBe('submitted')
    expect(submitted.refundTxHash).toBe(TX_HASH)

    const fetched = await strimz.refunds.retrieve(refund.id)
    expect(fetched).toEqual(submitted)
  })
})
