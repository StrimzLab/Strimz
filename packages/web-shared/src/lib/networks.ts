import { arcModeFor, type ApiKeyMode, type ArcEnvironment } from '@strimz/shared-config'

import { env } from './env'
import { siteUrls } from './site-urls'

export interface Network {
  mode: ApiKeyMode
  arcEnvironment: ArcEnvironment
  apiUrl: string
  arcRpcUrl: string
  checkoutUrl: string
  /** Empty until the Strimz test account has issued one. */
  publishableKey: string
}

export interface NetworkInputs {
  primary: Omit<Network, 'mode'>
  test: Partial<Pick<Network, 'apiUrl' | 'checkoutUrl' | 'arcRpcUrl' | 'publishableKey'>>
}

const trim = (url: string) => url.replace(/\/+$/, '')

function assertSecureUrl(name: string, value: string): string {
  const url = new URL(value)
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !local) {
    throw new Error(`${name} must be an https URL, got ${JSON.stringify(value)}`)
  }
  return trim(value)
}

/**
 * Test first, then live. A mainnet build adds test mode when its test API and checkout are
 * set (ADR-2026-11-26-test-mode); a testnet build is test only.
 */
export function resolveNetworks({ primary, test }: NetworkInputs): Network[] {
  const main: Network = { ...primary, mode: arcModeFor(primary.arcEnvironment) }
  if (main.mode === 'test' || !test.apiUrl || !test.checkoutUrl) return [main]
  return [
    {
      mode: 'test',
      arcEnvironment: 'testnet',
      apiUrl: assertSecureUrl('NEXT_PUBLIC_TEST_API_URL', test.apiUrl),
      arcRpcUrl: test.arcRpcUrl ?? '',
      checkoutUrl: assertSecureUrl('NEXT_PUBLIC_TEST_CHECKOUT_URL', test.checkoutUrl),
      publishableKey: test.publishableKey ?? '',
    },
    main,
  ]
}

export const networks: Network[] = resolveNetworks({
  primary: {
    arcEnvironment: env.arcEnvironment,
    apiUrl: trim(env.apiUrl),
    arcRpcUrl: env.arcRpcUrl,
    checkoutUrl: siteUrls.checkout,
    publishableKey: env.strimzPublishableKey,
  },
  test: {
    apiUrl: process.env.NEXT_PUBLIC_TEST_API_URL || undefined,
    checkoutUrl: process.env.NEXT_PUBLIC_TEST_CHECKOUT_URL || undefined,
    arcRpcUrl: process.env.NEXT_PUBLIC_TEST_ARC_RPC_URL || undefined,
    publishableKey: process.env.NEXT_PUBLIC_TEST_STRIMZ_PUBLISHABLE_KEY || undefined,
  },
})

export function networkFor(mode: ApiKeyMode): Network {
  const found = networks.find((n) => n.mode === mode)
  if (!found) throw new Error(`This dashboard has no ${mode} mode`)
  return found
}

/** The build's own network. Sign-in, onboarding and terms always run here. */
export const primaryNetwork: Network = networks[networks.length - 1] as Network

/** The extra test network a mainnet build adds, if configured. */
export const addedTestNetwork: Network | null = networks.length > 1 ? (networks[0] ?? null) : null
