import { UnauthorizedException } from '@nestjs/common'
import { kindFromKey } from '@strimz/shared-config'

export const PUBLISHABLE_KEY_REJECTED_MESSAGE =
  'publishable keys can only call /v1/checkout and /v1/tokens; use a secret key from your server'

export function assertSecretKeyKind(token: string): void {
  const kind = kindFromKey(token)
  if (kind === 'secret') return
  throw new UnauthorizedException({
    code: 'authentication_error',
    message: kind === 'publishable' ? PUBLISHABLE_KEY_REJECTED_MESSAGE : 'invalid api key kind',
  })
}
