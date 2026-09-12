/**
 * Arithmetic and refusal rules for funding an Arc checkout from
 * another chain. Split out of `useBridgeFunding` because these are the
 * parts where being wrong costs the payer money, and they are worth
 * testing without a wallet attached.
 */

/**
 * Ceiling on Circle's fast-transfer fee. 2bps, comfortably above the
 * ~1bps Circle charges. Quoting exactly would mean a round trip to
 * Circle's `/v2/burn/USDC/fees` before the payer can sign; a ceiling
 * that comes in under Circle's quote is not fatal either, since CCTP
 * falls back to standard finality, which is free and slower.
 */
export function defaultMaxFee(amount: bigint): bigint {
  return amount / 5000n
}

/**
 * What to burn so that `amount` survives the bridge.
 *
 * Circle takes its fee out of the transfer, so burning exactly the
 * session amount mints less than the payer owes and leaves them one
 * signature short of being able to pay at all. Grossing up by the fee
 * ceiling is what lets the mint wait below be an exact comparison
 * rather than a guess at what the fee turned out to be.
 */
export function burnAmountFor(amount: bigint, maxFee: bigint): bigint {
  return amount + maxFee
}

/** Whether the mint has landed. Exact: the gross-up guarantees it. */
export function hasArrived(arcBalance: bigint, amount: bigint): boolean {
  return arcBalance >= amount
}

/** Whether the payer needs the funding step before they can sign. */
export function needsFunding(arcBalance: bigint | undefined, amount: bigint): boolean {
  if (arcBalance === undefined || amount <= 0n) return false
  return arcBalance < amount
}

export interface BridgePreflight {
  fundable: boolean
  reason: string | null
  bridgeTxHash: string | null
}

/**
 * Why the payer must not burn, or null if they may. Runs before the
 * wallet opens — after `depositForBurn` there is no useful way to tell
 * someone we changed our mind.
 */
export function preflightRefusal(state: BridgePreflight): string | null {
  if (!state.fundable) {
    return state.reason ?? 'this session can no longer be paid'
  }
  if (state.bridgeTxHash) {
    return 'A transfer for this payment is already on its way. Reload the page to pick it up.'
  }
  return null
}

/**
 * CCTP mints to the same 20-byte address on the destination chain. An
 * EOA controls that address everywhere, because it derives from one
 * key. A smart account does not — a Safe on Arbitrum says nothing
 * about who, if anyone, controls the identical address on Arc, and
 * USDC minted there is unrecoverable. Bytecode on Arc is the signal we
 * can see from the browser, so we check it before the payer spends.
 *
 * EIP-3009 needs a real ECDSA signature anyway, so a contract account
 * cannot finish the payment leg either. This is the cheaper place to
 * say so.
 */
export function smartWalletRefusal(arcBytecode: string | undefined): string | null {
  if (arcBytecode && arcBytecode !== '0x') {
    return 'Smart-contract wallets cannot be funded by bridge yet — bridged USDC would land at an address you do not control on Arc. Pay from an EOA.'
  }
  return null
}
