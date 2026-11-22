import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { createPublicClient, type PublicClient } from 'viem'
import { getArcChain } from '@strimz/shared-config'
import { TypedConfigService } from '../../config/index.js'
import { assertEndpointsServeChain, rpcEndpoints, rpcTransport } from './rpc-endpoints.js'

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
  private readonly endpoints: string[]

  constructor(cfg: TypedConfigService) {
    this.environment = cfg.env.ARC_ENVIRONMENT
    this.production = cfg.env.NODE_ENV === 'production'
    this.endpoints = rpcEndpoints(cfg.env)
    this.client = createPublicClient({
      chain: getArcChain(this.environment),
      transport: rpcTransport(this.endpoints),
    })
  }

  async onModuleInit(): Promise<void> {
    if (!this.production) return
    const hosts = await assertEndpointsServeChain(this.environment, this.endpoints, (url) =>
      this.chainIdAt(url),
    )
    this.log.log(`RPC endpoints serve ${this.environment}: ${hosts.join(', ')}`)
  }

  /** One endpoint's chain id, asked directly rather than through the fallback. */
  chainIdAt(url: string): Promise<number> {
    return createPublicClient({ transport: rpcTransport([url]) }).getChainId()
  }

  getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber()
  }
}
