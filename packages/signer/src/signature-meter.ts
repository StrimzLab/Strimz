import type { PrivyWalletApi } from './privy-server-signer.js'

/** Privy's free plan covers 50,000 signatures a month for the whole app. */
export const PRIVY_MONTHLY_SIGNATURE_WARNING = 40_000

export interface SignatureMeterOptions {
  /** Atomically adds one to the key and returns the new total. */
  incr(key: string): Promise<number>
  warnAt: number
  onWarn(count: number, month: string): Promise<void>
  /** Counting is advisory: a failure is reported here and never blocks the signature. */
  onError(err: unknown): void
  now?: () => Date
}

/** Counts Privy signatures per calendar month across every service sharing the store. */
export function meterSignatures(api: PrivyWalletApi, opts: SignatureMeterOptions): PrivyWalletApi {
  const record = async () => {
    const month = (opts.now?.() ?? new Date()).toISOString().slice(0, 7)
    const count = await opts.incr(`privy:signatures:${month}`)
    if (count === opts.warnAt) await opts.onWarn(count, month)
  }
  return {
    walletAddress: (walletId) => api.walletAddress(walletId),
    async signTransaction(walletId, transaction) {
      const signed = await api.signTransaction(walletId, transaction)
      record().catch(opts.onError)
      return signed
    },
  }
}
