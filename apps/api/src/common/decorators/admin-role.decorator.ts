import { SetMetadata, applyDecorators } from '@nestjs/common'
import type { AdminRole } from '@strimz/db'

export const REQUIRED_ADMIN_ROLES_KEY = 'requiredAdminRoles'

/**
 * Declares the minimum admin roles allowed to call the handler.
 *
 * The AdminAuthGuard reads this metadata after authenticating the
 * caller, and rejects with 403 if the caller's role isn't in the list.
 *
 * No metadata on a handler = any active AdminUser may call it
 * (typical for `/v1/admin/me` and read-only KPI endpoints). The
 * defence-in-depth choice: handlers must explicitly opt into the
 * narrow `super_admin` gate; the default isn't "everyone allowed"
 * because admin-only controllers already enforce that via
 * `@UseGuards(AdminAuthGuard)` at the class level.
 */
export const RequireAdminRoles = (...roles: AdminRole[]) =>
  applyDecorators(SetMetadata(REQUIRED_ADMIN_ROLES_KEY, roles))
