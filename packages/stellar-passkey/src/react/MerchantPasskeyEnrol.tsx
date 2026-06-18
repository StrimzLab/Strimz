'use client'

import { type ReactNode, useCallback, useEffect, useState } from 'react'

import { detectCapabilities, isPasskeySupported } from '../capabilities.js'
import { createPasskey } from '../webauthn.js'
import { deriveMerchantWalletAddress } from '../derive.js'
import { type StellarNetwork } from '../network.js'
import type { CreatePasskeyResult, PasskeyEnrolError, PasskeyEnrolPhase } from '../types.js'

export interface MerchantPasskeyEnrolledResult extends CreatePasskeyResult {
  /**
   * The Soroban contract address (`C…`) the smart wallet will deploy
   * to. Same input → same address, forever — known before any
   * on-chain action.
   */
  walletAddress: string
}

export interface MerchantPasskeyEnrolProps {
  /**
   * Merchant email — surfaced in the OS-level passkey picker as the
   * authenticator's `user.name` and `user.displayName`, so the merchant
   * can identify which passkey is Strimz's later on.
   */
  merchantEmail: string

  /**
   * Strimz operator G-account that will deploy the wallet contract.
   * One per network. Read from `NEXT_PUBLIC_STELLAR_DEPLOYER_ADDRESS`
   * in apps/web.
   */
  deployer: string

  /** Which Stellar network the wallet will live on. */
  network: StellarNetwork

  /**
   * Called when enrolment succeeds. The result carries the credential
   * id, the SPKI-formatted public key (when the browser exposes it),
   * and the derived smart-wallet contract address.
   */
  onEnrolled: (result: MerchantPasskeyEnrolledResult) => void

  /**
   * Slot for an optional success-state render. Most consumers leave
   * this null and drive the success UI from `onEnrolled`.
   */
  renderSuccess?: (result: MerchantPasskeyEnrolledResult) => ReactNode

  /** Extra class on the wrapping element. */
  className?: string

  /** Override the trigger button label. */
  label?: string
}

/**
 * Drop-in onboarding component that runs the WebAuthn create-passkey
 * ceremony and yields the merchant's smart-wallet contract address.
 *
 * Render-only: uses zero external UI libraries, just Tailwind classes
 * that match the rest of the Strimz dashboard. Consumers can pass a
 * `className` to override the outer wrapper if needed.
 *
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
  label = 'Create Stellar wallet',
}: MerchantPasskeyEnrolProps) {
  const [phase, setPhase] = useState<PasskeyEnrolPhase>('idle')
  const [result, setResult] = useState<MerchantPasskeyEnrolledResult | null>(null)
  const [error, setError] = useState<PasskeyEnrolError | null>(null)
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void detectCapabilities().then((caps) => {
      if (!cancelled) setSupported(isPasskeySupported(caps))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setPhase('prompting')
    try {
      const ceremony = await createPasskey({
        rp: { name: 'Strimz' },
        user: {
          id: new TextEncoder().encode(merchantEmail),
          name: merchantEmail,
          displayName: merchantEmail,
        },
      })

      const walletAddress = deriveMerchantWalletAddress({
        credentialId: ceremony.credentialId,
        deployer,
        network,
      })

      const enrolled: MerchantPasskeyEnrolledResult = { ...ceremony, walletAddress }
      setResult(enrolled)
      setPhase('success')
      onEnrolled(enrolled)
    } catch (e) {
      // DOMException codes the WebAuthn flow can throw under user-cancel.
      const dom = e instanceof Error ? e : null
      const code =
        dom && dom.name === 'NotAllowedError'
          ? 'user_cancelled'
          : dom && dom.name === 'AbortError'
            ? 'user_cancelled'
            : 'unknown'
      setError({
        code,
        message:
          code === 'user_cancelled'
            ? 'Passkey prompt was dismissed.'
            : (dom?.message ?? 'Passkey enrolment failed.'),
      })
      setPhase('error')
    }
  }, [merchantEmail, deployer, network, onEnrolled])

  // Unsupported environments get a clear "you need a different browser"
  // message instead of a silent failure.
  if (supported === false) {
    return (
      <div
        className={`border-border/60 rounded-md border bg-amber-50/40 p-3 text-xs text-amber-900 ${className ?? ''}`.trim()}
      >
        Passkeys aren’t available on this device — try a recent version of Safari, Chrome, or
        Firefox in a secure context. You can still paste an existing Stellar address below.
      </div>
    )
  }

  if (phase === 'success' && result) {
    return (
      <div className={className}>
        {renderSuccess?.(result) ?? (
          <DefaultSuccess walletAddress={result.walletAddress} email={merchantEmail} />
        )}
      </div>
    )
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void start()}
        disabled={phase === 'prompting' || supported === null}
        className="font-poppins inline-flex h-9 items-center justify-center rounded-md bg-[#02C76A] px-3 text-xs font-medium text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {phase === 'prompting'
          ? 'Waiting for your device…'
          : supported === null
            ? 'Checking your device…'
            : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-600" data-passkey-error-code={error.code}>
          {error.message}
        </p>
      )}
    </div>
  )
}

function DefaultSuccess({ walletAddress, email }: { walletAddress: string; email: string }) {
  return (
    <div className="border-border/60 rounded-md border bg-[#02C76A]/5 p-3 text-xs">
      <div className="mb-1 font-medium text-[#02C76A]">Stellar wallet created.</div>
      <div className="text-muted-foreground">
        Linked to <span className="font-medium">{email}</span>.
      </div>
      <div className="text-muted-foreground mt-1">
        Contract address: <code className="break-all font-mono">{walletAddress}</code>
      </div>
    </div>
  )
}
