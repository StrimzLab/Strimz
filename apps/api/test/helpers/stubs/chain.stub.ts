/** Replaces viem-backed `ChainService`; never makes a network call. */
export class StubChainService {
  public readonly environment = 'testnet' as const
  public readonly client = {
    getBlockNumber: async () => 1n,
  } as never
  async getBlockNumber(): Promise<bigint> {
    return 1n
  }
}
