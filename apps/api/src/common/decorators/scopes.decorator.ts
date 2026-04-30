import { SetMetadata } from '@nestjs/common'
import type { ApiKeyScope } from '@strimz/shared-types'

export const REQUIRED_SCOPES_KEY = 'requiredScopes'

/** Tags a route with the API-key scopes required to call it. */
export const RequireScopes = (...scopes: ApiKeyScope[]) =>
  SetMetadata(REQUIRED_SCOPES_KEY, scopes)
