import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { createPublicClient, http, type PublicClient } from 'viem'
import { assertArcChainId, getArcChain } from '@strimz/shared-config'
import { TypedConfigService } from '../../config/index.js'

/**
 * Read-only viem client for Arc. The API never signs transactions; the
 * indexer reads events and the scheduler (separate process) signs from a
 * service wallet.
 */
@Injectable()
export class ChainService implements OnModuleInit {
  public readonly client: PublicClient
  public readonly environment: 'testnet' | 'mainnet'
  private readonly production: boolean
  private readonly log = new Logger(ChainService.name)

  constructor(cfg: TypedConfigService) {
    this.environment = cfg.env.ARC_ENVIRONMENT
    this.production = cfg.env.NODE_ENV === 'production'
    this.client = createPublicClient({
      chain: getArcChain(this.environment),
      transport: http(cfg.env.ARC_RPC_URL),
    })
  }

  async onModuleInit(): Promise<void> {
    if (!this.production) return
    const rpcChainId = await this.client.getChainId()
    assertArcChainId(this.environment, rpcChainId)
    this.log.log(`ARC_RPC_URL serves chain id ${rpcChainId} (${this.environment})`)
  }

  getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber()
  }
}
