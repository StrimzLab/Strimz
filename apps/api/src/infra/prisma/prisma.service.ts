import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { createPrismaClient, type PrismaClient } from '@strimz/db'
import { TypedConfigService } from '../../config/index.js'

/**
 * Singleton PrismaClient bound to NestJS's lifecycle.
 *
 * Composition over inheritance — Prisma 7's generated `PrismaClient` is a
 * factory-returned class which doesn't subclass cleanly with TypeScript.
 * Services read `this.prisma.db.<model>` to access the underlying client.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public readonly db: PrismaClient

  constructor(cfg: TypedConfigService) {
    this.db = createPrismaClient({ databaseUrl: cfg.env.DATABASE_URL })
  }

  async onModuleInit(): Promise<void> {
    await this.db.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.db.$disconnect()
  }
}
