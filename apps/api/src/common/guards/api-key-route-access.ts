import { ForbiddenException, type ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import type { ApiKeyScope } from '@strimz/shared-types'

import { REQUIRED_SCOPES_KEY } from '../decorators/scopes.decorator.js'
import { SESSION_ONLY_KEY } from '../decorators/session-only.decorator.js'

export function assertApiKeyRouteAccess(
  reflector: Reflector,
  ctx: ExecutionContext,
  keyScopes: readonly ApiKeyScope[],
): void {
  const targets = [ctx.getHandler(), ctx.getClass()]
  if (reflector.getAllAndOverride<boolean>(SESSION_ONLY_KEY, targets) === true) {
    throw new ForbiddenException({
      code: 'permission_denied',
      message: 'route requires a dashboard session',
    })
  }
  const required = reflector.getAllAndOverride<ApiKeyScope[]>(REQUIRED_SCOPES_KEY, targets) ?? []
  if (required.length === 0) {
    throw new ForbiddenException({
      code: 'permission_denied',
      message: 'route has no api key scope',
    })
  }
  const held = new Set<ApiKeyScope>(keyScopes)
  for (const scope of required) {
    if (!held.has(scope)) {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: `api key missing scope ${scope}`,
      })
    }
  }
}
