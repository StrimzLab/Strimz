import { createHash, randomBytes } from 'node:crypto'

export const ADMIN_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function hashAdminInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function issueAdminInviteToken(now: Date = new Date()) {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    hash: hashAdminInviteToken(token),
    expiresAt: new Date(now.getTime() + ADMIN_INVITE_TTL_MS),
  }
}
