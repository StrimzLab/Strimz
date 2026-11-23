import {
  getAddress,
  parseTransaction,
  recoverTransactionAddress,
  toHex,
  type Hex,
  type LocalAccount,
  type TransactionSerializable,
  type TransactionSerializedEIP1559,
} from 'viem'
import { toAccount } from 'viem/accounts'
import { PrivyClient } from '@privy-io/node'

/** The `eth_signTransaction` body Privy's wallet API takes. */
export interface PrivyTransaction {
  type: 2
  chain_id: number
  to: string
  data: string
  value: string
  nonce: number
  gas_limit: string
  max_fee_per_gas: string
  max_priority_fee_per_gas: string
}

/** The two Privy wallet calls Strimz makes; `privyWalletApi` is the real one. */
export interface PrivyWalletApi {
  walletAddress(walletId: string): Promise<string>
  signTransaction(walletId: string, transaction: PrivyTransaction): Promise<Hex>
}

export class PrivyPolicyViolationError extends Error {
  constructor(walletId: string) {
    super(`Privy refused to sign for wallet ${walletId}: the request breaks the wallet's policy`)
    this.name = 'PrivyPolicyViolationError'
  }
}

interface PrivyClientLike {
  wallets(): {
    get(walletId: string): Promise<{ address: string }>
    ethereum(): {
      signTransaction(
        walletId: string,
        input: {
          params: { transaction: PrivyTransaction }
          authorization_context: { authorization_private_keys: string[] }
        },
      ): Promise<unknown>
    }
  }
}

function isPolicyViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('error' in err)) return false
  const body = (err as { error: unknown }).error
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    (body as { code: unknown }).code === 'policy_violation'
  )
}

/** The real Privy client, for `privyWalletApi`. */
export function connectPrivyWalletApi(opts: {
  appId: string
  appSecret: string
  authorizationKey: string
}): PrivyWalletApi {
  const client = new PrivyClient({ appId: opts.appId, appSecret: opts.appSecret })
  return privyWalletApi(client as unknown as PrivyClientLike, opts.authorizationKey)
}

/** Privy's wallet API, signing as the server's authorization key (ADR-2026-11-22-privy-server-signers). */
export function privyWalletApi(client: PrivyClientLike, authorizationKey: string): PrivyWalletApi {
  return {
    async walletAddress(walletId) {
      return (await client.wallets().get(walletId)).address
    },
    async signTransaction(walletId, transaction) {
      let res: unknown
      try {
        res = await client
          .wallets()
          .ethereum()
          .signTransaction(walletId, {
            params: { transaction },
            authorization_context: { authorization_private_keys: [authorizationKey] },
          })
      } catch (err) {
        if (isPolicyViolation(err)) throw new PrivyPolicyViolationError(walletId)
        throw err
      }
      const signed = (res as { signed_transaction?: unknown }).signed_transaction
      if (typeof signed !== 'string' || !signed.startsWith('0x')) {
        throw new Error(`Privy returned no signed transaction for wallet ${walletId}`)
      }
      return signed as Hex
    },
  }
}

function toPrivyTransaction(tx: TransactionSerializable): PrivyTransaction {
  if (tx.type !== undefined && tx.type !== 'eip1559') {
    throw new Error(`Privy signer only sends EIP-1559 transactions, not ${tx.type}`)
  }
  const fields = tx as TransactionSerializable & {
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
  }
  if (
    fields.chainId === undefined ||
    !fields.to ||
    fields.nonce === undefined ||
    fields.gas === undefined ||
    fields.maxFeePerGas === undefined ||
    fields.maxPriorityFeePerGas === undefined
  ) {
    throw new Error('Privy signer needs chainId, to, nonce, gas and both fee fields set')
  }
  return {
    type: 2,
    chain_id: fields.chainId,
    to: fields.to,
    data: fields.data ?? '0x',
    value: toHex(fields.value ?? 0n),
    nonce: fields.nonce,
    gas_limit: toHex(fields.gas),
    max_fee_per_gas: toHex(fields.maxFeePerGas),
    max_priority_fee_per_gas: toHex(fields.maxPriorityFeePerGas),
  }
}

/** The fields where Privy's signed transaction differs from the request, as `name asked X signed Y`. */
function transactionDiff(asked: PrivyTransaction, signed: ReturnType<typeof parseTransaction>) {
  const askedData = asked.data.toLowerCase()
  const signedData = (signed.data ?? '0x').toLowerCase()
  const pairs: [string, unknown, unknown][] = [
    ['type', 'eip1559', signed.type],
    ['chainId', asked.chain_id, signed.chainId],
    ['to', asked.to.toLowerCase(), signed.to?.toLowerCase()],
    ['value', BigInt(asked.value), signed.value ?? 0n],
    ['nonce', asked.nonce, signed.nonce],
    ['gas', BigInt(asked.gas_limit), signed.gas],
    ['maxFeePerGas', BigInt(asked.max_fee_per_gas), signed.maxFeePerGas],
    ['maxPriorityFeePerGas', BigInt(asked.max_priority_fee_per_gas), signed.maxPriorityFeePerGas],
  ]
  const diffs = pairs
    .filter(([, a, b]) => a !== b)
    .map(([name, a, b]) => `${name} asked ${String(a)} signed ${String(b)}`)
  if (askedData !== signedData) {
    diffs.push(
      `data asked ${(askedData.length - 2) / 2} bytes signed ${(signedData.length - 2) / 2} bytes`,
    )
  }
  return diffs
}

/** A signer whose key stays in Privy. It signs whole transactions so Privy's policy can see them. */
export class PrivyServerSigner {
  readonly kind = 'privy' as const

  private constructor(
    readonly address: Hex,
    private readonly walletId: string,
    private readonly api: PrivyWalletApi,
  ) {}

  static async connect(opts: {
    api: PrivyWalletApi
    walletId: string
    expectedAddress: Hex
  }): Promise<PrivyServerSigner> {
    const actual = getAddress(await opts.api.walletAddress(opts.walletId))
    if (actual !== getAddress(opts.expectedAddress)) {
      throw new Error(
        `Privy wallet ${opts.walletId} is ${actual}, which does not match the configured ${opts.expectedAddress}`,
      )
    }
    return new PrivyServerSigner(actual, opts.walletId, opts.api)
  }

  toAccount(): LocalAccount {
    const refuse = (): Promise<Hex> =>
      Promise.reject(new Error('Privy signer only signs transactions'))
    return toAccount({
      address: this.address,
      signMessage: refuse,
      signTypedData: refuse,
      signTransaction: async (tx) => {
        const asked = toPrivyTransaction(tx)
        const signed = await this.api.signTransaction(this.walletId, asked)
        // Never broadcast something other than what we asked for.
        const parsed = parseTransaction(signed)
        const signer = await recoverTransactionAddress({
          serializedTransaction: signed as TransactionSerializedEIP1559,
        })
        const diffs = transactionDiff(asked, parsed)
        if (getAddress(signer) !== this.address) diffs.push(`signer ${getAddress(signer)}`)
        if (diffs.length > 0) {
          throw new Error(
            `Privy's signed transaction does not match the request for ${this.walletId}: ${diffs.join('; ')}`,
          )
        }
        return signed
      },
    })
  }
}
