import {
  CallExecutionError,
  ExecutionRevertedError,
  RawContractError,
  TransactionReceiptNotFoundError,
  type Hex,
} from 'viem'

/** Replaces viem-backed `ChainService`; never makes a network call. */
export class StubChainService {
  public environment: 'testnet' | 'mainnet' = 'testnet'
  public revertData: Hex | null = null
  public readonly calls: { to: Hex; data: Hex }[] = []
  public readonly client = {
    getBlockNumber: () => Promise.resolve(1n),
    getBlock: () => Promise.resolve({ timestamp: BigInt(Math.floor(Date.now() / 1000)) }),
    call: (args: { to: Hex; data: Hex }) => {
      this.calls.push({ to: args.to, data: args.data })
      if (this.revertData === null) return Promise.resolve({ data: undefined })
      return Promise.reject(
        new CallExecutionError(
          new ExecutionRevertedError({ cause: new RawContractError({ data: this.revertData }) }),
          {},
        ),
      )
    },
    getTransactionReceipt: ({ hash }: { hash: Hex }) =>
      Promise.reject(new TransactionReceiptNotFoundError({ hash })),
  } as never
  getBlockNumber(): Promise<bigint> {
    return Promise.resolve(1n)
  }
  reset(): void {
    this.revertData = null
    this.calls.length = 0
  }
}
