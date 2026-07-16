import { Injectable, NotFoundException } from '@nestjs/common'
import type {
  NotificationKind,
  NotificationListResponse,
  NotificationView,
} from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

/** Snippet length for the broadcast preview in the tray. */
const BROADCAST_SNIPPET_MAX = 140

/** How many notifications the dashboard tray shows at once. */
const DEFAULT_LIMIT = 20

/** Cap the per-source fetch so the merge doesn't blow up on chatty merchants. */
const PER_SOURCE_LIMIT = 30

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Materialises the merchant's notification tray on demand from
   * three sources: recent confirmed payment sessions (buys), new
   * active subscriptions (subscribers), processed refunds
   * (chargebacks the merchant just issued).
   *
   * "Real backend data" means: the read status, list ordering, and
   * unread count all come from the server. Nothing about the tray is
   * derived client-side except UI rendering.
   */
  async list(merchantId: string, limit: number): Promise<NotificationListResponse> {
    const merchant = await this.prisma.db.merchant.findUnique({
      where: { id: merchantId },
      select: { notificationsLastReadAt: true },
    })
    if (!merchant) {
      throw new NotFoundException({ code: 'not_found', message: 'merchant not found' })
    }

    const lastRead = merchant.notificationsLastReadAt

    // Pull the same source rows the tray needs. Individual limits stop
    // any one queue starving the others when we merge. Broadcasts are
    // fetched via an OR so we get platform-wide announcements + any
    // merchant-specific messages targeted at this merchant.
    const [confirmedSessions, activeSubs, refunds, broadcasts] = await Promise.all([
      this.prisma.db.paymentSession.findMany({
        where: { merchantId, status: 'confirmed' },
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
        select: {
          id: true,
          amount: true,
          currency: true,
          description: true,
          createdAt: true,
        },
      }),
      this.prisma.db.subscription.findMany({
        where: { merchantId, status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
        select: {
          id: true,
          amount: true,
          currency: true,
          interval: true,
          payerAddress: true,
          createdAt: true,
        },
      }),
      this.prisma.db.refund.findMany({
        where: { merchantId },
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
        select: {
          id: true,
          amount: true,
          currency: true,
          reason: true,
          createdAt: true,
        },
      }),
      this.prisma.db.adminBroadcast.findMany({
        where: {
          OR: [{ audience: 'all' }, { audience: 'merchant', merchantId }],
        },
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
        select: {
          id: true,
          title: true,
          body: true,
          createdAt: true,
        },
      }),
    ])

    const items: NotificationView[] = []

    for (const s of confirmedSessions) {
      items.push({
        id: `payment:${s.id}`,
        kind: 'payment_received' satisfies NotificationKind,
        title: 'Payment received',
        detail: `${formatUnit(s.amount, s.currency)} ${s.currency}${s.description ? ` — ${s.description}` : ''}`,
        href: `/app/payment-sessions?highlight=${s.id}`,
        createdAt: s.createdAt.toISOString(),
        read: lastRead != null && s.createdAt <= lastRead,
        sourceId: s.id,
      })
    }
    for (const sub of activeSubs) {
      items.push({
        id: `subscription:${sub.id}`,
        kind: 'subscription_started' satisfies NotificationKind,
        title: 'New subscriber',
        detail: `${formatUnit(sub.amount, sub.currency)} ${sub.currency}/${sub.interval} — ${shortenAddress(sub.payerAddress)}`,
        href: `/app/subscriptions?highlight=${sub.id}`,
        createdAt: sub.createdAt.toISOString(),
        read: lastRead != null && sub.createdAt <= lastRead,
        sourceId: sub.id,
      })
    }
    for (const r of refunds) {
      items.push({
        id: `refund:${r.id}`,
        kind: 'refund_processed' satisfies NotificationKind,
        title: 'Refund processed',
        detail: `${formatUnit(r.amount, r.currency)} ${r.currency}${r.reason ? ` — ${r.reason}` : ''}`,
        href: `/app/refunds?highlight=${r.id}`,
        createdAt: r.createdAt.toISOString(),
        read: lastRead != null && r.createdAt <= lastRead,
        sourceId: r.id,
      })
    }
    for (const b of broadcasts) {
      // Bodies come in as HTML (the admin composer is a rich-text
      // editor). The tray previews plain text so we strip tags for the
      // snippet; the full HTML is still available on the detail page.
      const plain = stripHtml(b.body)
      items.push({
        id: `broadcast:${b.id}`,
        kind: 'admin_broadcast' satisfies NotificationKind,
        title: b.title,
        detail:
          plain.length > BROADCAST_SNIPPET_MAX
            ? `${plain.slice(0, BROADCAST_SNIPPET_MAX).trimEnd()}…`
            : plain,
        href: `/app/notifications/${b.id}`,
        createdAt: b.createdAt.toISOString(),
        read: lastRead != null && b.createdAt <= lastRead,
        sourceId: b.id,
      })
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const capped = items.slice(0, limit || DEFAULT_LIMIT)
    const unreadCount = items.filter((n) => !n.read).length

    return {
      data: capped,
      unreadCount,
      lastReadAt: lastRead ? lastRead.toISOString() : null,
    }
  }

  /**
   * Set `notificationsLastReadAt = now()`. The next `list` call will
   * report every prior item as read + return `unreadCount === 0`.
   * The dashboard bell calls this the moment the tray opens so unread
   * state clears instantly.
   */
  async markAllRead(merchantId: string): Promise<{ lastReadAt: string }> {
    const now = new Date()
    const updated = await this.prisma.db.merchant.update({
      where: { id: merchantId },
      data: { notificationsLastReadAt: now },
      select: { notificationsLastReadAt: true },
    })
    return {
      lastReadAt: (updated.notificationsLastReadAt ?? now).toISOString(),
    }
  }
}

/**
 * Base-unit (6-decimal USDC/EURC) → human string, without importing
 * shared-config or dragging viem into apps/api. Two-decimal display.
 */
function formatUnit(base: string, _currency: string): string {
  try {
    const value = BigInt(base)
    const whole = value / 1_000_000n
    const frac = (value % 1_000_000n) / 10_000n
    return `${whole.toString()}.${frac.toString().padStart(2, '0')}`
  } catch {
    return base
  }
}

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/**
 * Cheap HTML → plain text conversion for the notification tray
 * preview. The admin composer produces basic TipTap-flavoured HTML
 * (paragraphs, bold, lists, links) — collapsing tags + entities is
 * enough for the snippet. The full HTML lands in the merchant email +
 * on the detail page unchanged.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
