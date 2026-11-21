import {
  CallExecutionError,
  ExecutionRevertedError,
  RawContractError,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  verifyTypedData,
  type Hex,
} from 'viem'

const DEFAULT_BALANCE = 1_000_000_000_000n

/** Replaces viem-backed `ChainService`; never makes a network call. */
export class StubChainService {
  public environment: 'testnet' | 'mainnet' = 'testnet'
  public revertData: Hex | null = null
  public balance = DEFAULT_BALANCE
  public gasEstimate = 150_000n
  public permitNonce = 0n
  public readonly balanceReads: { token: Hex; owner: Hex }[] = []
  public readonly calls: { to: Hex; data: Hex }[] = []
  /** Transactions a node knows about, by lower-case hash. */
  public readonly sentTxs = new Map<string, { from: Hex; nonce: number }>()
  public readonly client = {
    chain: { id: 5042002 },
    // Offline recovery: covers plain-key wallets, not ERC-1271.
    verifyTypedData: (args: Parameters<typeof verifyTypedData>[0]) => verifyTypedData(args),
    getBlockNumber: () => Promise.resolve(1n),
    getBlock: () => Promise.resolve({ timestamp: BigInt(Math.floor(Date.now() / 1000)) }),
    estimateGas: (args: { to: Hex; data: Hex }) => {
      this.calls.push({ to: args.to, data: args.data })
      if (this.revertData === null) return Promise.resolve(this.gasEstimate)
      return Promise.reject(
        new CallExecutionError(
          new ExecutionRevertedError({ cause: new RawContractError({ data: this.revertData }) }),
          {},
        ),
      )
    },
    readContract: (args: { address: Hex; functionName: string; args: readonly unknown[] }) => {
      if (args.functionName === 'nonces') return Promise.resolve(this.permitNonce)
      if (args.functionName !== 'balanceOf') {
        return Promise.reject(new Error(`StubChainService cannot read ${args.functionName}`))
      }
      this.balanceReads.push({ token: args.address, owner: args.args[0] as Hex })
      return Promise.resolve(this.balance)
    },
    getTransaction: ({ hash }: { hash: Hex }) => {
      const tx = this.sentTxs.get(hash.toLowerCase())
      return tx
        ? Promise.resolve({ hash, ...tx })
        : Promise.reject(new TransactionNotFoundError({ hash }))
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
    this.gasEstimate = 150_000n
    this.permitNonce = 0n
    this.sentTxs.clear()
  }
}
