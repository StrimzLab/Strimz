interface NonceManaged {
  address: `0x${string}`
  nonceManager?: { reset(params: { address: `0x${string}`; chainId: number }): void }
}

/**
 * viem's nonce manager keeps counting even when a send fails before broadcast,
 * which would leave a gap that stalls every later transaction.
 */
export async function withNonceReset<T>(
  account: NonceManaged,
  chainId: number,
  send: () => Promise<T>,
): Promise<T> {
  try {
    return await send()
  } catch (err) {
    account.nonceManager?.reset({ address: account.address, chainId })
    throw err
  }
}
