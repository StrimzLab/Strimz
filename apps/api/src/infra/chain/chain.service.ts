import { Injectable } from '@nestjs/common'
import { createPublicClient, http, type PublicClient } from 'viem'
import { arcMainnet, arcTestnet } from '@strimz/shared-config'
import { TypedConfigService } from '../../config/index.js'

/**
 * Read-only viem client for Arc. The API never signs transactions; the
 * indexer reads events and the scheduler (separate process) signs from a
 * service wallet.
 */
@Injectable()
export class ChainService {
  public readonly client: PublicClient
  public readonly environment: 'testnet' | 'mainnet'

  constructor(cfg: TypedConfigService) {
    this.environment = cfg.env.ARC_ENVIRONMENT
    const chain = this.environment === 'mainnet' ? arcMainnet : arcTestnet
    this.client = createPublicClient({
      chain,
      transport: http(cfg.env.ARC_RPC_URL),
    })
  }

  async getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber()
  }
}
