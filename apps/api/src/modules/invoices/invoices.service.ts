import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { CreateInvoiceInput, Invoice } from '@strimz/shared-types'
import { effectiveFeeBps } from '@strimz/shared-config'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { TypedConfigService } from '../../config/index.js'
import { EmailService } from '../../infra/email/email.service.js'
import { WebhookEventService } from '../../infra/events/webhook-event.service.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class InvoicesService {
  private readonly log = new Logger(InvoicesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: TypedConfigService,
    private readonly email: EmailService,
    private readonly events: WebhookEventService,
  ) {}

  async create(
    merchantId: string,
    mode: 'test' | 'live',
    input: CreateInvoiceInput,
  ): Promise<Invoice> {
    const subtotal = input.lineItems
      .reduce((acc, li) => acc + BigInt(li.unitAmount) * BigInt(li.quantity), 0n)
      .toString()
    const total = subtotal // No taxes / discounts in M1.
    const dueAt = new Date(Date.now() + (input.dueInDays ?? 7) * 86_400_000)
    const number = await this.nextInvoiceNumber(merchantId)

    const merchant = await this.prisma.db.merchant.findUniqueOrThrow({ where: { id: merchantId } })
    const feeBps = effectiveFeeBps(merchant.tier as never, 'one_shot') ?? 150
    const feeAmount = (BigInt(total) * BigInt(feeBps)) / 10_000n
    const netAmount = BigInt(total) - feeAmount

    const session = await this.prisma.db.paymentSession.create({
      data: {
        merchantId,
        amount: total,
        currency: input.currency,
        feeAmount: feeAmount.toString(),
        netAmount: netAmount.toString(),
        description: `Invoice ${number}`,
        checkoutUrl: '',
        mode,
        expiresAt: dueAt,
      },
    })
    await this.prisma.db.paymentSession.update({
      where: { id: session.id },
      data: { checkoutUrl: this.buildCheckoutUrl(session.id) },
    })

    const invoice = await this.prisma.db.invoice.create({
      data: {
        merchantId,
        number,
        customerName: input.customerName ?? null,
        customerEmail: input.customerEmail ?? null,
        lineItems: input.lineItems as never,
        subtotal,
        total,
        currency: input.currency,
        note: input.note ?? null,
        sessionId: session.id,
        mode,
        dueAt,
      },
    })

    void this.events
      .fire({
        merchantId,
        mode,
        name: 'invoice.created',
        data: serialise(invoice),
      })
      .catch((err) => this.log.warn(`invoice.created webhook failed: ${(err as Error).message}`))

    return serialise(invoice)
  }

  async retrieve(merchantId: string, id: string): Promise<Invoice> {
    const row = await this.prisma.db.invoice.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'invoice not found' })
    return serialise(row)
  }

  async list(
    merchantId: string,
    params: { limit?: number; cursor?: string | null; status?: string },
  ) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.invoice.findMany({
      where: { merchantId, status: (params.status as never) ?? undefined },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialise)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }

  async send(merchantId: string, id: string): Promise<Invoice> {
    const row = await this.prisma.db.invoice.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'invoice not found' })
    if (!row.customerEmail) {
      throw new ForbiddenException({
        code: 'invalid_request',
        message: 'invoice has no customer email — cannot send',
      })
    }
    if (row.status === 'void') {
      throw new ForbiddenException({
        code: 'session_invalid_state',
        message: 'invoice is voided',
      })
    }

    const checkoutUrl = row.sessionId
      ? this.buildCheckoutUrl(row.sessionId)
      : this.cfg.env.API_BASE_URL

    await this.email.send({
      to: row.customerEmail,
      subject: `Invoice ${row.number} from your supplier`,
      html: this.renderInvoiceEmail(row, checkoutUrl),
    })

    const updated = await this.prisma.db.invoice.update({
      where: { id: row.id },
      data: { status: 'sent', sentAt: new Date() },
    })
    return serialise(updated)
  }

  async voidInvoice(merchantId: string, id: string): Promise<Invoice> {
    const row = await this.prisma.db.invoice.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'invoice not found' })
    if (row.status === 'paid') {
      throw new ForbiddenException({
        code: 'session_invalid_state',
        message: 'paid invoice cannot be voided',
      })
    }
    const updated = await this.prisma.db.invoice.update({
      where: { id: row.id },
      data: { status: 'void' },
    })
    if (row.sessionId) {
      await this.prisma.db.paymentSession.update({
        where: { id: row.sessionId },
        data: { status: 'cancelled' },
      })
    }
    return serialise(updated)
  }

  /**
   * Daily cron — flips overdue invoices to `overdue` and fires a webhook.
   * Called by the scheduler app's overdue-invoices job.
   */
  async sweepOverdue(): Promise<{ marked: number }> {
    const overdue = await this.prisma.db.invoice.findMany({
      where: { status: { in: ['draft', 'sent'] }, dueAt: { lt: new Date() } },
    })
    for (const inv of overdue) {
      await this.prisma.db.invoice.update({
        where: { id: inv.id },
        data: { status: 'overdue' },
      })
      void this.events
        .fire({
          merchantId: inv.merchantId,
          mode: inv.mode as 'test' | 'live',
          name: 'invoice.overdue',
          data: serialise(inv),
        })
        .catch(() => undefined)
    }
    return { marked: overdue.length }
  }

  // ----- Helpers -----

  private async nextInvoiceNumber(merchantId: string): Promise<string> {
    const count = await this.prisma.db.invoice.count({ where: { merchantId } })
    const year = new Date().getFullYear()
    return `${year}-${String(count + 1).padStart(4, '0')}`
  }

  private buildCheckoutUrl(sessionId: string): string {
    return `${this.cfg.env.CHECKOUT_ORIGIN.replace(/\/$/, '')}/${sessionId}`
  }

  private renderInvoiceEmail(row: any, checkoutUrl: string): string {
    const items = (
      row.lineItems as Array<{ description: string; quantity: number; unitAmount: string }>
    )
      .map(
        (li) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(li.description)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${li.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${humanise(li.unitAmount)} ${row.currency}</td></tr>`,
      )
      .join('')
    return `
      <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:auto;color:#1a1a1a;">
        <h2 style="color:#02C76A;margin:0 0 16px;">Invoice ${escapeHtml(row.number)}</h2>
        ${row.note ? `<p>${escapeHtml(row.note)}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead><tr><th align="left" style="padding:8px;border-bottom:2px solid #ddd;">Item</th><th align="right" style="padding:8px;border-bottom:2px solid #ddd;">Qty</th><th align="right" style="padding:8px;border-bottom:2px solid #ddd;">Amount</th></tr></thead>
          <tbody>${items}</tbody>
          <tfoot><tr><td colspan="2" align="right" style="padding:12px 8px;font-weight:600;">Total</td><td align="right" style="padding:12px 8px;font-weight:600;">${humanise(row.total)} ${row.currency}</td></tr></tfoot>
        </table>
        <p>Due ${new Date(row.dueAt).toLocaleDateString()}</p>
        <p style="margin:24px 0;">
          <a href="${checkoutUrl}" style="display:inline-block;background:#02C76A;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Pay invoice</a>
        </p>
      </div>
    `
  }
}

function serialise(row: any): Invoice {
  return {
    id: row.id,
    merchantId: row.merchantId,
    number: row.number,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    lineItems: row.lineItems,
    subtotal: row.subtotal,
    total: row.total,
    currency: row.currency,
    status: row.status,
    note: row.note,
    sessionId: row.sessionId,
    dueAt: row.dueAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } as Invoice
}

function humanise(rawAmount: string): string {
  // Convert smallest-unit string to display amount. Assumes 6 decimals (USDC/EURC).
  const v = BigInt(rawAmount)
  const whole = v / 1_000_000n
  const frac = (v % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '')
  return frac.length === 0 ? whole.toString() : `${whole}.${frac}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
