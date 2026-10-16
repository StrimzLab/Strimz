import {
  CallExecutionError,
  ExecutionRevertedError,
  RawContractError,
  TransactionReceiptNotFoundError,
  type Hex,
} from 'viem'

const DEFAULT_BALANCE = 1_000_000_000_000n

/** Replaces viem-backed `ChainService`; never makes a network call. */
export class StubChainService {
  public environment: 'testnet' | 'mainnet' = 'testnet'
  public revertData: Hex | null = null
  public balance = DEFAULT_BALANCE
  public readonly balanceReads: { token: Hex; owner: Hex }[] = []
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
    readContract: (args: { address: Hex; functionName: string; args: readonly unknown[] }) => {
      if (args.functionName !== 'balanceOf') {
        return Promise.reject(new Error(`StubChainService cannot read ${args.functionName}`))
      }
      this.balanceReads.push({ token: args.address, owner: args.args[0] as Hex })
      return Promise.resolve(this.balance)
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
    this.balance = DEFAULT_BALANCE
    this.balanceReads.length = 0
  }
}
