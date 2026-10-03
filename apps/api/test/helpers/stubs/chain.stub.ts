/** Replaces viem-backed `ChainService`; never makes a network call. */
export class StubChainService {
  public environment: 'testnet' | 'mainnet' = 'testnet'
  public readonly client = {
    getBlockNumber: () => Promise.resolve(1n),
  } as never
  getBlockNumber(): Promise<bigint> {
    return Promise.resolve(1n)
  }
}
