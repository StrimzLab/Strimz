import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard.js'
import { RequireAdminRoles } from '../../common/decorators/admin-role.decorator.js'
import {
  CurrentAdmin,
  type CurrentAdminPayload,
} from '../../common/decorators/current-admin.decorator.js'
import { AdminService } from './admin.service.js'
import {
  InviteAdminDto,
  SetAdminRoleDto,
  SetAdminStatusDto,
  SetMerchantStatusDto,
  SetMerchantTierDto,
} from './admin.dto.js'

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
  overview() {
    return this.admin.getOverview()
  }

  // ------------------------------------------------------------------
  // Merchants
  // ------------------------------------------------------------------
  @Get('/merchants')
  @ApiOperation({ summary: 'List merchants with filters + pagination.' })
  listMerchants(
    @Query('status') status?: string,
    @Query('tier') tier?: string,
    @Query('query') query?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.admin.listMerchants({
      status,
      tier,
      query,
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
    })
  }

  @Get('/merchants/:id')
  @ApiOperation({ summary: 'Merchant detail with stats.' })
  getMerchant(@Param('id') id: string) {
    return this.admin.getMerchant(id)
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
  volumeSeries(@Query('from') from?: string, @Query('to') to?: string) {
    return this.admin.getVolumeSeries({ from, to })
  }

  @Get('/analytics/signups')
  @ApiOperation({ summary: 'Daily merchant signups over a date range.' })
  signupSeries(@Query('from') from?: string, @Query('to') to?: string) {
    return this.admin.getSignupSeries({ from, to })
  }

  @Get('/analytics/top-merchants')
  @ApiOperation({ summary: 'Top merchants by confirmed-transaction volume.' })
  topMerchants(@Query('limit') limit?: string) {
    return this.admin.getTopMerchants(limit ? Number(limit) : undefined)
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
}
