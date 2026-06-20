/**
 * Thin abstraction over `@stellar/stellar-sdk`'s `rpc.Server`.
 *
 * The adapter only ever calls two methods (`getAccount` and
 * `simulateTransaction`), so the interface stays narrow. The narrow
 * surface is what makes the adapter testable: tests inject a hand-
 * rolled fake that returns simulation fixtures instead of hitting
 * network — no MSW, no nock, no live RPC.
 *
 * Real implementations should construct an `rpc.Server` per chain (one
 * per network) and pass it to the adapter constructor; lazy default
 * fallback creates one from `config.rpcUrl` if none is supplied.
 */

import type { Account, Transaction, rpc } from '@stellar/stellar-sdk'

export interface StellarRpcClient {
  /** Fetches the account so a builder can pull a fresh sequence. */
  getAccount(address: string): Promise<Account>

  /**
   * Runs the Soroban simulation that populates auth entries +
   * resource fees. The caller then `assembleTransaction`s the
   * result into a sign-ready transaction.
   */
  simulateTransaction(tx: Transaction): Promise<rpc.Api.SimulateTransactionResponse>
}
