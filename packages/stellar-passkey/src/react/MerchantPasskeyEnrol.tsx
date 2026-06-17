import { type ReactNode, useMemo } from 'react'
import {
  type CreatePasskeyResult,
  createPasskey,
  detectCapabilities,
  selectFallbacks,
  toBase64Url,
} from '@passkey-ui/core'
import { createCreatePasskeyFlow } from '@passkey-ui/ui'
import { CreatePasskey } from '@passkey-ui/ui/react'

import { deriveMerchantWalletAddress } from '../derive.js'
import { type StellarNetwork } from '../network.js'
import { STRIMZ_PASSKEY_THEME } from '../theme.js'

export interface MerchantPasskeyEnrolledResult {
  /** Raw credential id bytes — used as the salt for deterministic derive. */
  credentialId: Uint8Array
  /** Base64url-encoded credential id — what we persist on the AdminUser side. */
  credentialIdBase64Url: string
  /** P-256 public key from the authenticator (when surfaced). */
  publicKey?: Uint8Array
  /**
   * The Soroban contract address (C…) the smart wallet will deploy to.
   * Derived deterministically from (credentialId, deployer, network);
   * known before any on-chain action.
   */
  walletAddress: string
}

export interface MerchantPasskeyEnrolProps {
  /**
   * Merchant email — surfaced in the WebAuthn prompt as the
   * authenticator's user.name. The browser shows it on the OS-level
   * passkey picker so the merchant can identify which passkey is
   * Strimz's.
   */
  merchantEmail: string

  /**
   * The deployer account that will create the merchant's wallet
   * contract. For Strimz this is the operator G-account (one per
   * network) — `STELLAR_DEPLOYER_ADDRESS` on the API side, sourced
   * from `SupportedChain.rpcConfig` and exposed to the browser via
   * `NEXT_PUBLIC_STELLAR_DEPLOYER_ADDRESS`.
   */
  deployer: string

  /** Which Stellar network the wallet will deploy on. */
  network: StellarNetwork

  /**
   * Fires when the enrolment ceremony completes successfully. The
   * returned `walletAddress` is the address that goes into the
   * merchant's `payoutAddresses['stellar:pubnet' | 'stellar:testnet']`.
   */
  onEnrolled: (result: MerchantPasskeyEnrolledResult) => void

  /** Optional success view; defaults to none (the form drives the UX). */
  renderSuccess?: (result: MerchantPasskeyEnrolledResult) => ReactNode

  /** Additional class on the `<PasskeyFlow>` wrapper. */
  className?: string
}

/**
 * Drop-in component that runs the create-passkey ceremony and yields a
 * Strimz-shaped result including the derived smart-wallet address.
 *
 * Designed for the merchant onboarding form: render alongside the EVM
 * payout section, let the merchant create one or skip Stellar entirely.
 * The wallet contract is NOT deployed here — only the address is
 * captured. Lazy deploy lands in M5 when the first payment routes to
 * the merchant on Stellar.
 */
export function MerchantPasskeyEnrol({
  merchantEmail,
  deployer,
  network,
  onEnrolled,
  renderSuccess,
  className,
}: MerchantPasskeyEnrolProps) {
  const flow = useMemo(
    () =>
      createCreatePasskeyFlow({
        detectCapabilities,
        selectFallbacks,
        createPasskey: async (input) => {
          const result = await createPasskey(input)
          // Compute the wallet address synchronously after the ceremony
          // and call onEnrolled — the success render runs after.
          const walletAddress = deriveMerchantWalletAddress({
            credentialId: result.credentialId,
            deployer,
            network,
          })
          onEnrolled({
            credentialId: result.credentialId,
            credentialIdBase64Url: toBase64Url(result.credentialId),
            publicKey: result.publicKey,
            walletAddress,
          })
          return result
        },
        input: {
          rp: { name: 'Strimz' },
          user: {
            // Stable, unique id per merchant — the email works for this.
            id: new TextEncoder().encode(merchantEmail),
            name: merchantEmail,
            displayName: merchantEmail,
          },
        },
      }),
    [merchantEmail, deployer, network, onEnrolled],
  )

  return (
    <CreatePasskey<CreatePasskeyResult>
      flow={flow}
      theme={STRIMZ_PASSKEY_THEME}
      autoStart={false}
      labels={{
        action: 'Create Stellar wallet',
        prompting: 'Confirm with your device to create your Stellar wallet…',
        success: 'Stellar wallet created.',
      }}
      className={className}
      renderSuccess={(result) => {
        if (renderSuccess) {
          // Re-derive on the success render in case the consumer wants
          // to show the address in the success state. Cheap; no I/O.
          const walletAddress = deriveMerchantWalletAddress({
            credentialId: result.credentialId,
            deployer,
            network,
          })
          return renderSuccess({
            credentialId: result.credentialId,
            credentialIdBase64Url: toBase64Url(result.credentialId),
            publicKey: result.publicKey,
            walletAddress,
          })
        }
        return null
      }}
    />
  )
}
