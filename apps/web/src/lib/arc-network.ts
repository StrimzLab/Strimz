import { isArcEnvironment, type ArcEnvironment } from '@strimz/shared-config'

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
