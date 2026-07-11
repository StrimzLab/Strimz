import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import type { AdminRole, AdminUserStatus, MerchantTier } from '@strimz/db'
import {
  AdminBroadcastEmail,
  AdminInviteEmail,
  AdminRoleChangedEmail,
  AdminStatusChangedEmail,
  renderToHtml,
} from '@strimz/email-templates'
import type { BroadcastAudience, CreateBroadcastInput } from '@strimz/shared-types'

import { TypedConfigService } from '../../config/index.js'
import { EmailService } from '../../infra/email/email.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

interface DateRange {
  from?: string
  to?: string
}

/**
 * The admin service is intentionally just-a-thin-wrapper on Prisma.
 * Each method returns a plain object; the controller decides what's
 * paginated, what's shaped, what's filtered.
 *
 * Two non-obvious decisions worth flagging:
 *
 *   1. Platform-wide aggregations don't use `merchantId` scoping — by
 *      design. Admin is the only caller and the only place these queries
 *      get used.
 *   2. Mutations write an `AuditLog` entry with `category: 'admin'` so
 *      every state change is attributable to a specific admin. The
 *      controller layer plumbs the `actorId` through.
 */
@Injectable()
export class AdminService {
  private readonly log = new Logger(AdminService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly cfg: TypedConfigService,
  ) {}

  // ------------------------------------------------------------------
  // Profile
  // ------------------------------------------------------------------
  async getMe(adminId: string) {
    const admin = await this.prisma.db.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })
    if (!admin) throw new NotFoundException({ code: 'not_found' })
    return admin
  }

  // ------------------------------------------------------------------
  // Platform overview
  // ------------------------------------------------------------------
  async getOverview() {
    const [
      merchants,
      activeSubscriptions,
      confirmedSessions,
      lifetimeVolumeRow,
      lifetimeFeesRow,
      last30dVolumeRow,
      last30dSignups,
    ] = await Promise.all([
      this.prisma.db.merchant.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.db.subscription.count({ where: { status: 'active' } }),
      this.prisma.db.paymentSession.count({ where: { status: 'confirmed' } }),
      this.prisma.db.$queryRawUnsafe<{ sum: bigint | null }[]>(
        `SELECT sum(("amount")::numeric)::bigint AS sum FROM "Transaction" WHERE status='confirmed'`,
      ),
      this.prisma.db.$queryRawUnsafe<{ sum: bigint | null }[]>(
        `SELECT sum(("feeAmount")::numeric)::bigint AS sum FROM "Transaction" WHERE status='confirmed'`,
      ),
      this.prisma.db.$queryRawUnsafe<{ sum: bigint | null }[]>(
        `SELECT sum(("amount")::numeric)::bigint AS sum
         FROM "Transaction"
         WHERE status='confirmed' AND "blockTimestamp" >= NOW() - INTERVAL '30 days'`,
      ),
      this.prisma.db.merchant.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      }),
    ])

    // MRR — sum of every active subscription's monthly-normalised amount.
    const activeSubs = await this.prisma.db.subscription.findMany({
      where: { status: 'active' },
      select: { amount: true, interval: true, intervalCount: true },
    })
    let mrrUnits = 0n
    for (const s of activeSubs) {
      mrrUnits += normaliseToMonthly(BigInt(s.amount), s.interval, s.intervalCount)
    }

    const merchantsByStatus: Record<string, number> = {}
    let totalMerchants = 0
    for (const row of merchants) {
      merchantsByStatus[row.status] = row._count._all
      totalMerchants += row._count._all
    }

    return {
      merchants: {
        total: totalMerchants,
        byStatus: merchantsByStatus,
        last30dSignups,
      },
      volume: {
        lifetimeUsdc: (lifetimeVolumeRow[0]?.sum ?? 0n).toString(),
        lifetimeFeesUsdc: (lifetimeFeesRow[0]?.sum ?? 0n).toString(),
        last30dUsdc: (last30dVolumeRow[0]?.sum ?? 0n).toString(),
        confirmedSessions,
      },
      subscriptions: {
        active: activeSubscriptions,
        mrrUsdc: mrrUnits.toString(),
      },
    }
  }

  // ------------------------------------------------------------------
  // Merchants
  // ------------------------------------------------------------------
  async listMerchants(params: {
    status?: string
    tier?: string
    query?: string
    limit?: number
    cursor?: string | null
  }) {
    const limit = Math.min(params.limit ?? 25, 100)
    const where: Record<string, unknown> = {}
    if (params.status) where.status = params.status
    if (params.tier) where.tier = params.tier
    if (params.query) {
      where.OR = [
        { email: { contains: params.query, mode: 'insensitive' } },
        { businessName: { contains: params.query, mode: 'insensitive' } },
      ]
    }

    const merchants = await this.prisma.db.merchant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        email: true,
        businessName: true,
        tier: true,
        status: true,
        defaultCurrency: true,
        countryCode: true,
        createdAt: true,
        lastLoginAt: true,
      },
    })

    const hasMore = merchants.length > limit
    const data = hasMore ? merchants.slice(0, limit) : merchants
    const nextCursor = hasMore ? data[data.length - 1]!.id : null

    return { data, nextCursor, hasMore }
  }

  async getMerchant(merchantId: string) {
    const merchant = await this.prisma.db.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        email: true,
        businessName: true,
        tier: true,
        status: true,
        payoutAddress: true,
        defaultCurrency: true,
        countryCode: true,
        websiteUrl: true,
        logoUrl: true,
        onchainMerchantId: true,
        createdAt: true,
        lastLoginAt: true,
      },
    })
    if (!merchant) throw new NotFoundException({ code: 'not_found' })

    // Counts adjacent to the merchant — useful in the drilldown.
    const [paymentCount, subscriptionCount, lifetimeRow, last30dRow] = await Promise.all([
      this.prisma.db.paymentSession.count({
        where: { merchantId, status: 'confirmed' },
      }),
      this.prisma.db.subscription.count({
        where: { merchantId, status: 'active' },
      }),
      this.prisma.db.$queryRawUnsafe<{ sum: bigint | null }[]>(
        `SELECT sum(("amount")::numeric)::bigint AS sum
         FROM "Transaction" WHERE "merchantId" = $1 AND status='confirmed'`,
        merchantId,
      ),
      this.prisma.db.$queryRawUnsafe<{ sum: bigint | null }[]>(
        `SELECT sum(("amount")::numeric)::bigint AS sum
         FROM "Transaction"
         WHERE "merchantId" = $1 AND status='confirmed'
           AND "blockTimestamp" >= NOW() - INTERVAL '30 days'`,
        merchantId,
      ),
    ])

    return {
      ...merchant,
      stats: {
        confirmedPayments: paymentCount,
        activeSubscriptions: subscriptionCount,
        lifetimeVolumeUsdc: (lifetimeRow[0]?.sum ?? 0n).toString(),
        last30dVolumeUsdc: (last30dRow[0]?.sum ?? 0n).toString(),
      },
    }
  }

  async setMerchantStatus(
    merchantId: string,
    nextStatus: 'active' | 'suspended' | 'closed',
    actorId: string,
  ) {
    const merchant = await this.prisma.db.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, status: true },
    })
    if (!merchant) throw new NotFoundException({ code: 'not_found' })
    if (merchant.status === nextStatus) {
      throw new BadRequestException({
        code: 'invalid_state',
        message: `merchant already ${nextStatus}`,
      })
    }

    const updated = await this.prisma.db.merchant.update({
      where: { id: merchantId },
      data: { status: nextStatus },
      select: { id: true, status: true, email: true, businessName: true },
    })

    await this.writeAudit({
      actorId,
      merchantId,
      action: `merchant.${nextStatus}`,
      targetType: 'Merchant',
      targetId: merchantId,
      metadata: { previous: merchant.status, next: nextStatus },
    })

    return updated
  }

  async setMerchantTier(merchantId: string, tier: MerchantTier, actorId: string) {
    const merchant = await this.prisma.db.merchant.findUnique({
      where: { id: merchantId },
      select: { tier: true },
    })
    if (!merchant) throw new NotFoundException({ code: 'not_found' })

    const updated = await this.prisma.db.merchant.update({
      where: { id: merchantId },
      data: { tier },
      select: { id: true, tier: true },
    })

    await this.writeAudit({
      actorId,
      merchantId,
      action: 'merchant.tier_changed',
      targetType: 'Merchant',
      targetId: merchantId,
      metadata: { previous: merchant.tier, next: tier },
    })

    return updated
  }

  // ------------------------------------------------------------------
  // Analytics — platform-wide
  // ------------------------------------------------------------------
  async getVolumeSeries(range: DateRange) {
    const from = range.from ? new Date(range.from) : new Date(Date.now() - 90 * 86_400_000)
    const to = range.to ? new Date(range.to) : new Date()
    type Row = { day: Date; volume: bigint; fees: bigint; count: bigint }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT
         date_trunc('day', "blockTimestamp")::timestamp AS day,
         sum(("amount")::numeric)::bigint AS volume,
         sum(("feeAmount")::numeric)::bigint AS fees,
         count(*) AS count
       FROM "Transaction"
       WHERE status='confirmed' AND "blockTimestamp" BETWEEN $1 AND $2
       GROUP BY day
       ORDER BY day ASC`,
      from,
      to,
    )) as Row[]
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      data: rows.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        volume: r.volume.toString(),
        fees: r.fees.toString(),
        count: Number(r.count),
      })),
    }
  }

  async getSignupSeries(range: DateRange) {
    const from = range.from ? new Date(range.from) : new Date(Date.now() - 90 * 86_400_000)
    const to = range.to ? new Date(range.to) : new Date()
    type Row = { day: Date; count: bigint }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT date_trunc('day', "createdAt")::timestamp AS day, count(*) AS count
       FROM "Merchant"
       WHERE "createdAt" BETWEEN $1 AND $2
       GROUP BY day
       ORDER BY day ASC`,
      from,
      to,
    )) as Row[]
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      data: rows.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        count: Number(r.count),
      })),
    }
  }

  async getTopMerchants(limit = 10) {
    type Row = {
      merchantId: string
      businessName: string | null
      email: string
      volume: bigint
      txCount: bigint
    }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT
         m.id AS "merchantId",
         m."businessName",
         m.email,
         sum(("t"."amount")::numeric)::bigint AS volume,
         count(*) AS "txCount"
       FROM "Merchant" m
       JOIN "Transaction" t ON t."merchantId" = m.id
       WHERE t.status = 'confirmed'
       GROUP BY m.id
       ORDER BY volume DESC
       LIMIT $1`,
      Math.min(limit, 50),
    )) as Row[]
    return {
      data: rows.map((r) => ({
        merchantId: r.merchantId,
        businessName: r.businessName,
        email: r.email,
        volumeUsdc: r.volume.toString(),
        transactionCount: Number(r.txCount),
      })),
    }
  }

  // ------------------------------------------------------------------
  // Operational health
  // ------------------------------------------------------------------
  async getHealth() {
    // Indexer cursor — how far behind. We can't actually reach the
    // RPC from here without complicating the service; surface what
    // Postgres knows. The dashboard adds context.
    const cursors = await this.prisma.db.indexerCursor.findMany({
      select: {
        contractAddress: true,
        environment: true,
        lastProcessedBlock: true,
        updatedAt: true,
      },
    })

    // Webhook delivery health — counts over the last hour.
    type DeliveryRow = { status: string; count: bigint }
    const recentDeliveries = (await this.prisma.db.$queryRawUnsafe(
      `SELECT status, count(*) AS count
       FROM "WebhookDelivery"
       WHERE "createdAt" >= NOW() - INTERVAL '1 hour'
       GROUP BY status`,
    )) as DeliveryRow[]
    const webhookDelivery: Record<string, number> = {}
    for (const row of recentDeliveries) {
      webhookDelivery[row.status] = Number(row.count)
    }

    // Subscription health — at-risk / lapsed counts.
    const [atRisk, lapsedRecent] = await Promise.all([
      this.prisma.db.subscription.count({ where: { status: 'at_risk' } }),
      this.prisma.db.subscription.count({
        where: {
          status: 'lapsed',
          updatedAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
        },
      }),
    ])

    return {
      indexerCursors: cursors.map((c) => ({
        contractAddress: c.contractAddress,
        environment: c.environment,
        lastProcessedBlock: c.lastProcessedBlock.toString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      webhookDelivery1h: webhookDelivery,
      subscriptions: {
        atRisk,
        lapsedLast7d: lapsedRecent,
      },
    }
  }

  // ------------------------------------------------------------------
  // Admin user management (super_admin only — controller enforces)
  // ------------------------------------------------------------------
  async listAdmins() {
    const admins = await this.prisma.db.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        invitedAt: true,
        lastLoginAt: true,
        createdAt: true,
        invitedBy: { select: { id: true, email: true } },
      },
    })
    return { data: admins }
  }

  async inviteAdmin(input: { email: string; name?: string; role: AdminRole; invitedById: string }) {
    const existing = await this.prisma.db.adminUser.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { id: true },
    })
    if (existing) {
      throw new BadRequestException({ code: 'already_exists', message: 'email already admin' })
    }

    // Read the inviter so the email can carry an attributable "added
    // by Emmanuel (emma@strimz.finance)" line. Falls back to "A Strimz
    // admin" if the row is gone (shouldn't happen — guard checked it).
    const inviter = await this.prisma.db.adminUser.findUnique({
      where: { id: input.invitedById },
      select: { name: true, email: true },
    })

    const admin = await this.prisma.db.adminUser.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name ?? null,
        role: input.role,
        invitedById: input.invitedById,
      },
      select: { id: true, email: true, name: true, role: true, status: true, invitedAt: true },
    })

    await this.writeAudit({
      actorId: input.invitedById,
      action: 'admin.invited',
      targetType: 'AdminUser',
      targetId: admin.id,
      metadata: { email: admin.email, role: admin.role },
    })

    // Best-effort email. A Resend failure shouldn't roll back the row
    // — the invitee can still be told out-of-band, and the dashboard
    // lets the inviter re-trigger. We log and continue.
    try {
      const html = await renderToHtml(
        AdminInviteEmail({
          inviteeName: admin.name,
          role: admin.role,
          inviterDisplay: inviter?.name ?? inviter?.email ?? 'A Strimz admin',
          inviterEmail: inviter?.email ?? 'strimztokenstream@gmail.com',
          dashboardUrl: `${this.cfg.env.STRIMZ_DASHBOARD_URL.replace(/\/+$/, '')}/admin`,
        }),
      )
      const result = await this.email.send({
        to: admin.email,
        subject: 'You’re a Strimz admin',
        html,
      })
      this.log.log(
        `admin invite emailed: to=${admin.email} resendId=${result.id ?? 'stub'} queued=${result.queued}`,
      )
    } catch (err: unknown) {
      this.log.warn(
        `admin invite email failed for ${admin.email}: ${(err as Error).message} — row still created`,
      )
    }

    return admin
  }

  async setAdminRole(adminId: string, role: AdminRole, actorId: string) {
    if (adminId === actorId) {
      // Stops a super_admin from accidentally demoting themselves.
      throw new BadRequestException({
        code: 'cannot_modify_self',
        message: "you can't change your own role",
      })
    }

    // Snapshot the previous role so the email and the audit log can
    // both report the diff. One query — Prisma's `update` doesn't
    // surface previous values for us.
    const previous = await this.prisma.db.adminUser.findUnique({
      where: { id: adminId },
      select: { name: true, email: true, role: true },
    })
    if (!previous) throw new NotFoundException({ code: 'not_found' })
    if (previous.role === role) {
      throw new BadRequestException({
        code: 'invalid_state',
        message: `admin already ${role}`,
      })
    }

    const [actor, updated] = await Promise.all([
      this.prisma.db.adminUser.findUnique({
        where: { id: actorId },
        select: { name: true, email: true },
      }),
      this.prisma.db.adminUser.update({
        where: { id: adminId },
        data: { role },
        select: { id: true, email: true, role: true },
      }),
    ])

    await this.writeAudit({
      actorId,
      action: 'admin.role_changed',
      targetType: 'AdminUser',
      targetId: adminId,
      metadata: { previous: previous.role, next: role },
    })

    // Best-effort email to the affected admin so they're not
    // surprised when previously working buttons start returning
    // `403 admin_insufficient_role`. A Resend failure logs but does
    // not roll back the role change.
    try {
      const html = await renderToHtml(
        AdminRoleChangedEmail({
          adminName: previous.name,
          previousRole: previous.role,
          newRole: role,
          actorDisplay: actor?.name ?? actor?.email ?? 'A Strimz super admin',
          actorEmail: actor?.email ?? 'strimztokenstream@gmail.com',
          dashboardUrl: `${this.cfg.env.STRIMZ_DASHBOARD_URL.replace(/\/+$/, '')}/admin`,
        }),
      )
      await this.email.send({
        to: previous.email,
        subject: 'Your Strimz admin role was updated',
        html,
      })
    } catch (err: unknown) {
      this.log.warn(
        `admin role-change email failed for ${previous.email}: ${(err as Error).message} — change still applied`,
      )
    }

    return updated
  }

  async setAdminStatus(adminId: string, status: AdminUserStatus, actorId: string) {
    if (adminId === actorId) {
      throw new BadRequestException({
        code: 'cannot_modify_self',
        message: "you can't suspend yourself",
      })
    }

    const previous = await this.prisma.db.adminUser.findUnique({
      where: { id: adminId },
      select: { name: true, email: true, status: true },
    })
    if (!previous) throw new NotFoundException({ code: 'not_found' })
    if (previous.status === status) {
      throw new BadRequestException({
        code: 'invalid_state',
        message: `admin already ${status}`,
      })
    }

    const [actor, updated] = await Promise.all([
      this.prisma.db.adminUser.findUnique({
        where: { id: actorId },
        select: { name: true, email: true },
      }),
      this.prisma.db.adminUser.update({
        where: { id: adminId },
        data: { status },
        select: { id: true, email: true, status: true },
      }),
    ])

    await this.writeAudit({
      actorId,
      action: `admin.${status}`,
      targetType: 'AdminUser',
      targetId: adminId,
      metadata: { previous: previous.status, next: status },
    })

    // Best-effort email. Suspended branch carries a danger pill +
    // "reply to us if this is a mistake" CTA; reactivated branch is
    // a welcome-back. The DELETE handler aliases to suspended, so it
    // fires this email too with the suspended branch.
    try {
      const html = await renderToHtml(
        AdminStatusChangedEmail({
          adminName: previous.name,
          newStatus: status,
          actorDisplay: actor?.name ?? actor?.email ?? 'A Strimz super admin',
          actorEmail: actor?.email ?? 'strimztokenstream@gmail.com',
          dashboardUrl: `${this.cfg.env.STRIMZ_DASHBOARD_URL.replace(/\/+$/, '')}/admin`,
        }),
      )
      await this.email.send({
        to: previous.email,
        subject:
          status === 'suspended'
            ? 'Your Strimz admin access has been paused'
            : 'Your Strimz admin access has been restored',
        html,
      })
    } catch (err: unknown) {
      this.log.warn(
        `admin status-change email failed for ${previous.email}: ${(err as Error).message} — change still applied`,
      )
    }

    return updated
  }

  // ------------------------------------------------------------------
  // Audit log helper
  // ------------------------------------------------------------------
  private async writeAudit(args: {
    actorId: string
    merchantId?: string
    action: string
    targetType: string
    targetId: string
    metadata?: Record<string, unknown>
  }) {
    await this.prisma.db.auditLog.create({
      data: {
        merchantId: args.merchantId ?? null,
        actorId: args.actorId,
        category: 'admin',
        action: args.action,
        targetType: args.targetType,
        targetId: args.targetId,
        metadata: (args.metadata ?? {}) as never,
      },
    })
  }

  // ---------- Broadcasts ----------

  /**
   * Fans a message out to every affected merchant. Two audiences:
   *
   *   - `all` — every currently-active merchant. Used for platform
   *     announcements (new features, maintenance).
   *   - `merchant` — a single merchant. Used by ops responding to
   *     support tickets or tier changes.
   *
   * The row is committed first, then emails go out. Email failures
   * DON'T roll back the row — a dashboard notification is still a
   * successful delivery. `emailedAt` records the moment the fan-out
   * finished so ops can see delivery status. Closed / suspended
   * merchants are skipped from email fan-out but still see the tray
   * notification on next login.
   */
  async createBroadcast(input: CreateBroadcastInput, senderId: string) {
    const sender = await this.prisma.db.adminUser.findUnique({
      where: { id: senderId },
      select: { id: true, email: true, name: true },
    })
    if (!sender) {
      throw new NotFoundException({ code: 'not_found', message: 'admin not found' })
    }
    if (input.audience === 'merchant') {
      if (!input.merchantId) {
        throw new BadRequestException({
          code: 'invalid_request',
          message: 'merchantId is required for merchant-audience broadcasts',
        })
      }
      const merchant = await this.prisma.db.merchant.findUnique({
        where: { id: input.merchantId },
        select: { id: true },
      })
      if (!merchant) {
        throw new BadRequestException({
          code: 'invalid_request',
          message: 'merchantId does not exist',
        })
      }
    }

    const row = await this.prisma.db.adminBroadcast.create({
      data: {
        senderId,
        title: input.title,
        body: input.body,
        audience: input.audience,
        merchantId: input.audience === 'merchant' ? input.merchantId! : null,
      },
      include: {
        sender: { select: { id: true, email: true, name: true } },
        merchant: { select: { id: true, email: true, businessName: true } },
      },
    })

    const recipients =
      input.audience === 'merchant'
        ? row.merchant
          ? [
              {
                id: row.merchant.id,
                email: row.merchant.email,
                businessName: row.merchant.businessName,
              },
            ]
          : []
        : await this.prisma.db.merchant.findMany({
            where: { status: 'active' },
            select: { id: true, email: true, businessName: true },
          })

    const senderDisplay = sender.name ?? sender.email
    const dashboardUrl = `${this.cfg.env.STRIMZ_DASHBOARD_URL.replace(/\/$/, '')}/app`

    let deliveryFailed = 0
    await Promise.all(
      recipients.map(async (r) => {
        try {
          const html = await renderToHtml(
            AdminBroadcastEmail({
              recipientName: r.businessName,
              title: input.title,
              body: input.body,
              senderDisplay,
              senderEmail: sender.email,
              dashboardUrl,
              audience: input.audience,
            }),
          )
          await this.email.send({
            to: r.email,
            subject: input.title,
            html,
            replyTo: sender.email,
          })
        } catch (err) {
          deliveryFailed += 1
          this.log.warn(
            `broadcast email to ${r.email} failed: ${(err as Error).message} — dashboard notification still delivered`,
          )
        }
      }),
    )

    await this.prisma.db.adminBroadcast.update({
      where: { id: row.id },
      data: { emailedAt: new Date() },
    })

    await this.writeAudit({
      actorId: senderId,
      action: 'admin.broadcast.create',
      targetType: 'AdminBroadcast',
      targetId: row.id,
      metadata: {
        audience: input.audience,
        merchantId: input.merchantId ?? null,
        recipients: recipients.length,
        emailFailed: deliveryFailed,
      },
    })

    this.log.log(
      `broadcast ${row.id} sent by ${sender.email}: audience=${input.audience} recipients=${recipients.length} emailFailed=${deliveryFailed}`,
    )

    return serialiseBroadcast(row)
  }

  /**
   * Recent broadcasts, sorted newest-first. Powers the admin
   * dashboard's "Broadcasts" table so operators can see what they've
   * sent, when, and to whom.
   */
  async listBroadcasts(params: { audience?: BroadcastAudience; limit?: number }) {
    // 100 max, matching every other list endpoint. Callers that need
    // deep history should paginate.
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100)
    const rows = await this.prisma.db.adminBroadcast.findMany({
      where: params.audience ? { audience: params.audience } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: { select: { id: true, email: true, name: true } },
        merchant: { select: { id: true, email: true, businessName: true } },
      },
    })
    return { data: rows.map(serialiseBroadcast) }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialiseBroadcast(row: any) {
  return {
    id: row.id as string,
    title: row.title as string,
    body: row.body as string,
    audience: row.audience as BroadcastAudience,
    merchantId: (row.merchantId as string | null) ?? null,
    merchantEmail: (row.merchant?.email as string | null) ?? null,
    senderId: row.senderId as string,
    senderEmail: row.sender?.email as string,
    emailedAt: row.emailedAt ? (row.emailedAt as Date).toISOString() : null,
    createdAt: (row.createdAt as Date).toISOString(),
  }
}

/**
 * Same helper as in the merchant analytics service — duplicated here
 * to avoid cross-module coupling. Both are tiny.
 */
function normaliseToMonthly(amount: bigint, interval: string, intervalCount: number): bigint {
  const factor = BigInt(intervalCount || 1)
  switch (interval) {
    case 'daily':
      return (amount * 30n) / factor
    case 'weekly':
      return (amount * 30n) / (factor * 7n)
    case 'monthly':
      return amount / factor
    case 'quarterly':
      return amount / (factor * 3n)
    case 'yearly':
      return amount / (factor * 12n)
    default:
      return amount
  }
}
