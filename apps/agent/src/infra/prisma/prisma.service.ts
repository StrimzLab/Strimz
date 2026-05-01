import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createPrismaClient, type PrismaClient } from '@strimz/db'
import type { Env } from '../../config/env.schema.js'

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public readonly db: PrismaClient

  constructor(config: ConfigService<Env, true>) {
    const databaseUrl = config.getOrThrow<string>('DATABASE_URL', { infer: true })
    this.db = createPrismaClient({ databaseUrl })
  }

  async onModuleInit(): Promise<void> {
    await this.db.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.db.$disconnect()
  }
}
