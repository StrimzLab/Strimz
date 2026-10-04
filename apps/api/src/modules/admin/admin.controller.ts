import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard.js'
import { PrivySessionGuard } from '../../common/guards/privy-session.guard.js'
import { RequireAdminRoles } from '../../common/decorators/admin-role.decorator.js'
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { listQuerySchema, type ListQuery } from '../../common/schemas/list-query.js'
import {
  CurrentAdmin,
  type CurrentAdminPayload,
} from '../../common/decorators/current-admin.decorator.js'
import {
  CurrentPrivySession,
  type CurrentPrivySessionPayload,
} from '../../common/decorators/current-privy-session.decorator.js'
import { AdminService } from './admin.service.js'
import {
  AcceptAdminInviteDto,
  CreateBroadcastDto,
  InviteAdminDto,
  SetAdminRoleDto,
  SetAdminStatusDto,
  SetMerchantStatusDto,
  SetMerchantTierDto,
} from './admin.dto.js'
import {
  adminStatsModeQuerySchema,
  adminTopMerchantsQuerySchema,
  adminVolumeQuerySchema,
  type BroadcastAudience,
  type Mode,
  type PaymentCurrency,
} from '@strimz/shared-types'

/**
 * `/v1/admin/*` surface for Strimz operators.
 *
 * Auth: every handler runs through `AdminAuthGuard`. Read endpoints
 * accept any active admin; mutations gate by role via
 * `@RequireAdminRoles(...)`.
 *
 * Routing convention: read paths follow the same `GET /resource`
 * shape as the merchant API; write paths are explicit verbs
 * (`/:id/suspend`, `/:id/role`) so the audit log reads naturally.
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('/v1/admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ------------------------------------------------------------------
  // Profile
  // ------------------------------------------------------------------
  @Get('/me')
  @ApiOperation({ summary: 'Current admin profile.' })
  me(@CurrentAdmin() ctx: CurrentAdminPayload) {
    return this.admin.getMe(ctx.adminId)
  }

  // ------------------------------------------------------------------
  // Platform overview
  // ------------------------------------------------------------------
  @Get('/overview')
  @ApiOperation({ summary: 'Platform-wide KPIs.' })
  overview(@Query(new ZodValidationPipe(adminStatsModeQuerySchema)) q: { mode: Mode }) {
    return this.admin.getOverview(q.mode)
  }

  // ------------------------------------------------------------------
  // Merchants
  // ------------------------------------------------------------------
  @Get('/merchants')
  @ApiOperation({ summary: 'List merchants with filters + pagination.' })
  listMerchants(@Query(new ZodValidationPipe(listQuerySchema)) q: ListQuery) {
    return this.admin.listMerchants({
      status: q.status,
      tier: q.tier,
      query: q.query,
      limit: q.limit,
      cursor: q.cursor ?? null,
    })
  }

  @Get('/merchants/:id')
  @ApiOperation({ summary: 'Merchant detail with stats.' })
  getMerchant(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(adminStatsModeQuerySchema)) q: { mode: Mode },
  ) {
    return this.admin.getMerchant(id, q.mode)
  }

  @RequireAdminRoles('super_admin', 'admin')
  @Post('/merchants/:id/suspend')
  @ApiOperation({ summary: 'Suspend a merchant. Active sessions still settle; new ones refuse.' })
  suspendMerchant(@CurrentAdmin() ctx: CurrentAdminPayload, @Param('id') id: string) {
    return this.admin.setMerchantStatus(id, 'suspended', ctx.adminId)
  }

  @RequireAdminRoles('super_admin', 'admin')
  @Post('/merchants/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended merchant.' })
  reactivateMerchant(@CurrentAdmin() ctx: CurrentAdminPayload, @Param('id') id: string) {
    return this.admin.setMerchantStatus(id, 'active', ctx.adminId)
  }

  @RequireAdminRoles('super_admin', 'admin')
  @Post('/merchants/:id/close')
  @ApiOperation({ summary: 'Permanently close a merchant account.' })
  closeMerchant(@CurrentAdmin() ctx: CurrentAdminPayload, @Param('id') id: string) {
    return this.admin.setMerchantStatus(id, 'closed', ctx.adminId)
  }

  @RequireAdminRoles('super_admin', 'admin')
  @Patch('/merchants/:id/tier')
  @ApiOperation({ summary: 'Change a merchant tier (free / growth / scale / enterprise).' })
  setMerchantTier(
    @CurrentAdmin() ctx: CurrentAdminPayload,
    @Param('id') id: string,
    @Body() dto: SetMerchantTierDto,
  ) {
    return this.admin.setMerchantTier(id, dto.tier, ctx.adminId)
  }

  @RequireAdminRoles('super_admin', 'admin')
  @Patch('/merchants/:id/status')
  @ApiOperation({
    summary: 'Set merchant status explicitly. Same effect as suspend/reactivate.',
  })
  setMerchantStatus(
    @CurrentAdmin() ctx: CurrentAdminPayload,
    @Param('id') id: string,
    @Body() dto: SetMerchantStatusDto,
  ) {
    return this.admin.setMerchantStatus(id, dto.status, ctx.adminId)
  }

  // ------------------------------------------------------------------
  // Analytics
  // ------------------------------------------------------------------
  @Get('/analytics/volume')
  @ApiOperation({ summary: 'Daily platform volume (gross + fees) over a date range.' })
  volumeSeries(
    @Query(new ZodValidationPipe(adminVolumeQuerySchema))
    q: {
      from?: string
      to?: string
      mode: Mode
    },
  ) {
    return this.admin.getVolumeSeries({ from: q.from, to: q.to }, q.mode)
  }

  @Get('/analytics/signups')
  @ApiOperation({ summary: 'Daily merchant signups over a date range.' })
  signupSeries(@Query('from') from?: string, @Query('to') to?: string) {
    return this.admin.getSignupSeries({ from, to })
  }

  @Get('/analytics/top-merchants')
  @ApiOperation({ summary: 'Top merchants by confirmed-transaction volume.' })
  topMerchants(
    @Query(new ZodValidationPipe(adminTopMerchantsQuerySchema))
    q: {
      currency: PaymentCurrency
      mode: Mode
      limit: number
    },
  ) {
    return this.admin.getTopMerchants(q)
  }

  // ------------------------------------------------------------------
  // Operational health
  // ------------------------------------------------------------------
  @Get('/health')
  @ApiOperation({ summary: 'Indexer + webhook + subscription operational health.' })
  health() {
    return this.admin.getHealth()
  }

  // ------------------------------------------------------------------
  // Admin user management (super_admin)
  // ------------------------------------------------------------------
  @Get('/admins')
  @ApiOperation({ summary: 'List admin users.' })
  listAdmins() {
    return this.admin.listAdmins()
  }

  @RequireAdminRoles('super_admin')
  // Tight per-admin cap. Legit ops rarely need more than a handful of
  // invites/hour; anything above that is a UI bug or a compromised key.
  @RateLimit({ max: 5, windowMs: 60 * 60 * 1000, keyBy: 'actor', label: 'admin.invite' })
  @Post('/admins')
  @ApiOperation({ summary: 'Invite a new admin (by email).' })
  inviteAdmin(@CurrentAdmin() ctx: CurrentAdminPayload, @Body() dto: InviteAdminDto) {
    return this.admin.inviteAdmin({
      email: dto.email,
      name: dto.name,
      role: dto.role,
      invitedById: ctx.adminId,
    })
  }

  @RequireAdminRoles('super_admin')
  @RateLimit({ max: 5, windowMs: 60 * 60 * 1000, keyBy: 'actor', label: 'admin.invite_resend' })
  @Post('/admins/:id/invite')
  @ApiOperation({ summary: 'Re-send a pending invite with a new token.' })
  resendInvite(@CurrentAdmin() ctx: CurrentAdminPayload, @Param('id') id: string) {
    return this.admin.resendInvite(id, ctx.adminId)
  }

  @RequireAdminRoles('super_admin')
  @Patch('/admins/:id/role')
  @ApiOperation({ summary: "Change an admin's role." })
  setAdminRole(
    @CurrentAdmin() ctx: CurrentAdminPayload,
    @Param('id') id: string,
    @Body() dto: SetAdminRoleDto,
  ) {
    return this.admin.setAdminRole(id, dto.role, ctx.adminId)
  }

  @RequireAdminRoles('super_admin')
  @Patch('/admins/:id/status')
  @ApiOperation({ summary: 'Suspend or reactivate an admin.' })
  setAdminStatus(
    @CurrentAdmin() ctx: CurrentAdminPayload,
    @Param('id') id: string,
    @Body() dto: SetAdminStatusDto,
  ) {
    return this.admin.setAdminStatus(id, dto.status, ctx.adminId)
  }

  @RequireAdminRoles('super_admin')
  @Delete('/admins/:id')
  @ApiOperation({ summary: 'Suspend an admin (alias for setAdminStatus → suspended).' })
  removeAdmin(@CurrentAdmin() ctx: CurrentAdminPayload, @Param('id') id: string) {
    return this.admin.setAdminStatus(id, 'suspended', ctx.adminId)
  }

  // ------------------------------------------------------------------
  // Broadcasts — platform announcements + merchant-scoped messages
  // ------------------------------------------------------------------

  @RequireAdminRoles('super_admin', 'admin')
  @Post('/broadcasts')
  @ApiOperation({
    summary:
      'Send a broadcast. Audience `all` fans out to every active merchant; `merchant` messages one merchant by id.',
  })
  createBroadcast(@CurrentAdmin() ctx: CurrentAdminPayload, @Body() dto: CreateBroadcastDto) {
    return this.admin.createBroadcast(dto, ctx.adminId)
  }

  @Get('/broadcasts')
  @ApiOperation({
    summary: 'Recent broadcasts sent by any admin. Read for any active admin.',
  })
  listBroadcasts(@Query(new ZodValidationPipe(listQuerySchema)) q: ListQuery) {
    return this.admin.listBroadcasts({
      audience: q.audience as BroadcastAudience | undefined,
      limit: q.limit,
    })
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(PrivySessionGuard)
@Controller('/v1/admin/invites')
export class AdminInvitesController {
  constructor(private readonly admin: AdminService) {}

  @Post('/accept')
  @HttpCode(200)
  @RateLimit({ max: 20, windowMs: 15 * 60 * 1000, keyBy: 'ip', label: 'admin.invite_accept' })
  @ApiOperation({ summary: 'Accept an admin invite with its one-time token.' })
  acceptInvite(
    @CurrentPrivySession() session: CurrentPrivySessionPayload,
    @Body() dto: AcceptAdminInviteDto,
  ) {
    return this.admin.acceptInvite({ token: dto.token, privyUserId: session.privyUserId })
  }
}
