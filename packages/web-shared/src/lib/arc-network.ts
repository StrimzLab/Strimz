import { getArcChain, isArcEnvironment, type ArcEnvironment } from '@strimz/shared-config'

export function resolveArcEnvironment(
  raw: string | undefined,
  nodeEnv: string | undefined,
): ArcEnvironment {
  if (raw === undefined && nodeEnv !== 'production') return 'testnet'
  if (isArcEnvironment(raw)) return raw
  throw new Error(
    `NEXT_PUBLIC_ARC_ENVIRONMENT must be testnet or mainnet, got ${JSON.stringify(raw)}`,
  )
}

export interface SwitchableWallet {
  chainId: () => Promise<number | undefined>
  switchChain: (chainId: number) => Promise<unknown>
}

export class WrongChainError extends Error {
  constructor(
    readonly expectedChainId: number,
    options?: { cause?: unknown },
  ) {
    super(`Switch your wallet to Arc (chain ${expectedChainId}) to continue.`, options)
    this.name = 'WrongChainError'
  }
}

export async function prepareArcSigning(
  wallet: SwitchableWallet,
  environment: ArcEnvironment,
): Promise<number> {
  const expected = getArcChain(environment).id
  if ((await wallet.chainId()) === expected) return expected
  try {
    await wallet.switchChain(expected)
  } catch (err) {
    throw new WrongChainError(expected, { cause: err })
  }
  if ((await wallet.chainId()) !== expected) throw new WrongChainError(expected)
  return expected
}
