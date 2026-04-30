import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getQueueToken } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedWebhookEndpoint } from '../helpers/fixtures.js'
import { InvoiceOverdueService } from '../../src/crons/invoice-overdue/invoice-overdue.service.js'
import { QUEUE_NAMES } from '../../src/infra/queue/queue-names.js'

describe('invoice-overdue cron e2e', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    const q: Queue = t.app.get(getQueueToken(QUEUE_NAMES.webhookDelivery))
    await q.drain(true)
  })

  it('flips overdue invoices, fires invoice.overdue, queues deliveries to subscribed endpoints', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/h',
      events: ['invoice_overdue'],
      mode: 'test',
    })

    const overdueAt = new Date(Date.now() - 2 * 86_400_000)
    await t.prisma.db.invoice.create({
      data: {
        merchantId: merchant.id,
        number: '2026-0001',
        lineItems: [{ description: 'Service', quantity: 1, unitAmount: '100' }] as never,
        subtotal: '100',
        total: '100',
        currency: 'USDC',
        status: 'sent',
        mode: 'test',
        dueAt: overdueAt,
      },
    })
    // Not overdue yet.
    await t.prisma.db.invoice.create({
      data: {
        merchantId: merchant.id,
        number: '2026-0002',
        lineItems: [{ description: 'Future', quantity: 1, unitAmount: '100' }] as never,
        subtotal: '100',
        total: '100',
        currency: 'USDC',
        status: 'draft',
        mode: 'test',
        dueAt: new Date(Date.now() + 86_400_000),
      },
    })
    // Already paid — must not flip even if past due.
    await t.prisma.db.invoice.create({
      data: {
        merchantId: merchant.id,
        number: '2026-0003',
        lineItems: [{ description: 'Paid', quantity: 1, unitAmount: '100' }] as never,
        subtotal: '100',
        total: '100',
        currency: 'USDC',
        status: 'paid',
        mode: 'test',
        dueAt: overdueAt,
      },
    })

    const cron = t.app.get(InvoiceOverdueService)
    const result = await cron.sweepNow()
    expect(result.flipped).toBe(1)
    expect(result.deliveriesQueued).toBe(1)

    const states = await t.prisma.db.invoice.findMany({ orderBy: { number: 'asc' } })
    expect(states.map((s) => s.status)).toEqual(['overdue', 'draft', 'paid'])

    const events = await t.prisma.db.webhookEvent.findMany({ where: { type: 'invoice_overdue' } })
    expect(events).toHaveLength(1)

    const deliveries = await t.prisma.db.webhookDelivery.findMany()
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]!.status).toBe('pending')

    const q: Queue = t.app.get(getQueueToken(QUEUE_NAMES.webhookDelivery))
    const queued = await q.getJobs(['waiting', 'delayed', 'active'])
    expect(queued).toHaveLength(1)
  })

  it('returns 0/0 when nothing is overdue', async () => {
    const cron = t.app.get(InvoiceOverdueService)
    const result = await cron.sweepNow()
    expect(result.flipped).toBe(0)
    expect(result.deliveriesQueued).toBe(0)
  })
})
