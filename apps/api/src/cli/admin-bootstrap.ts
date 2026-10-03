import type { PrismaClient } from '@strimz/db'

import type { PrivyService } from '../infra/privy/privy.service.js'

export type AdminBootstrapErrorCode =
  | 'invalid_privy_did'
  | 'privy_lookup_failed'
  | 'privy_user_has_no_email'
  | 'super_admin_exists'
  | 'admin_already_exists'

export class AdminBootstrapError extends Error {
  constructor(
    readonly code: AdminBootstrapErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'AdminBootstrapError'
  }
}

export interface AdminBootstrapDeps {
  prisma: PrismaClient
  privy: Pick<PrivyService, 'getUser' | 'primaryEmail'>
}

export interface AdminBootstrapInput {
  privyUserId: string
  name?: string
}

const PRIVY_DID_PREFIX = 'did:privy:'

export async function bootstrapSuperAdmin(
  { prisma, privy }: AdminBootstrapDeps,
  { privyUserId, name }: AdminBootstrapInput,
) {
  if (!privyUserId.startsWith(PRIVY_DID_PREFIX) || privyUserId.length <= PRIVY_DID_PREFIX.length) {
    throw new AdminBootstrapError(
      'invalid_privy_did',
      `expected a Privy DID starting with ${PRIVY_DID_PREFIX}`,
    )
  }

  const user = await privy.getUser(privyUserId).catch((err: unknown) => {
    throw new AdminBootstrapError(
      'privy_lookup_failed',
      `could not fetch Privy user ${privyUserId}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  })
  const email = privy.primaryEmail(user)
  if (!email) {
    throw new AdminBootstrapError(
      'privy_user_has_no_email',
      `Privy user ${privyUserId} has no email on record`,
    )
  }

  return prisma.$transaction(
    async (tx) => {
      const activeSuperAdmin = await tx.adminUser.findFirst({
        where: { role: 'super_admin', status: 'active' },
        select: { id: true },
      })
      if (activeSuperAdmin) {
        throw new AdminBootstrapError(
          'super_admin_exists',
          'an active super_admin already exists; invite further admins from the dashboard',
        )
      }

      const existing = await tx.adminUser.findFirst({
        where: { OR: [{ privyUserId }, { email }] },
        select: { id: true },
      })
      if (existing) {
        throw new AdminBootstrapError(
          'admin_already_exists',
          `admin row ${existing.id} already holds this Privy DID or email`,
        )
      }

      const admin = await tx.adminUser.create({
        data: {
          privyUserId,
          email,
          name: name ?? null,
          role: 'super_admin',
          status: 'active',
        },
        select: {
          id: true,
          privyUserId: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: null,
          category: 'admin',
          action: 'admin.bootstrapped',
          targetType: 'AdminUser',
          targetId: admin.id,
          metadata: { via: 'cli', privyUserId, email },
        },
      })

      return admin
    },
    { isolationLevel: 'Serializable' },
  )
}
