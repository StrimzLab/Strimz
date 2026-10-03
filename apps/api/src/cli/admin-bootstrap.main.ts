import 'reflect-metadata'
import { parseArgs } from 'node:util'
import { ConfigService } from '@nestjs/config'
import { createPrismaClient } from '@strimz/db'

import { envSchema, type Env } from '../config/env.schema.js'
import { TypedConfigService } from '../config/typed-config.service.js'
import { PrivyService } from '../infra/privy/privy.service.js'
import { AdminBootstrapError, bootstrapSuperAdmin } from './admin-bootstrap.js'

const USAGE =
  'usage: node dist/cli/admin-bootstrap.main.js --privy-did did:privy:<id> [--name "<name>"]'

const cliEnvSchema = envSchema.pick({
  DATABASE_URL: true,
  PRIVY_APP_ID: true,
  PRIVY_APP_SECRET: true,
  PRIVY_VERIFICATION_KEY: true,
})

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'privy-did': { type: 'string' },
      name: { type: 'string' },
    },
    strict: true,
  })
  const privyUserId = values['privy-did']
  if (!privyUserId) throw new Error(`--privy-did is required\n${USAGE}`)

  const parsed = cliEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
    throw new Error(`invalid environment: ${issues}`)
  }
  const env = parsed.data
  const privy = new PrivyService(new TypedConfigService(new ConfigService<Env, true>(env)))
  const prisma = createPrismaClient({ databaseUrl: env.DATABASE_URL })

  try {
    const admin = await bootstrapSuperAdmin({ prisma, privy }, { privyUserId, name: values.name })
    process.stdout.write(`${JSON.stringify(admin, null, 2)}\n`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err: unknown) => {
  const message =
    err instanceof AdminBootstrapError
      ? `${err.code}: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err)
  process.stderr.write(`admin:bootstrap failed: ${message}\n`)
  process.exitCode = 1
})
