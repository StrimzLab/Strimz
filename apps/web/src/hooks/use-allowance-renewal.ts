'use client'

import { useState } from 'react'
import { useAccount, useConfig, useSignTypedData, useSwitchChain } from 'wagmi'
import { getAccount, getBytecode, readContract } from '@wagmi/core'
import { erc20Abi } from 'viem'
import { buildPermitTypedData } from '@strimz/sdk/eip712'
import type { TokenMetadata } from '@strimz/shared-types'

import { prepareArcSigning } from '@/lib/arc-network'
import { checkoutSubmissionUrl, submitCheckoutRelay } from '@/lib/checkout-submission'
import { env } from '@/lib/env'
import { strimzBrowserClient } from '@/lib/strimz-browser'
import { topUpAllowance } from '@/lib/subscription-allowance'
import { walletSignature } from '@/lib/wallet-signature'

export interface Renewal {
  subscriptionId: string
  status: string
  planName: string
  merchantName: string | null
  amount: string
  currency: 'USDC' | 'EURC'
  token: `0x${string}`
  payerAddress: string
  spender: `0x${string}`
  suggestedAllowance: string
}

type Step = 'idle' | 'signing' | 'submitting' | 'done' | 'failed'

const POLL_MS = 1500
const POLL_LIMIT_MS = 120_000

/** Signs and relays a permit topping up the payer's allowance to Subscriptions. */
export function useAllowanceRenewal(
  subscriptionId: string,
  renewal: Renewal | null,
  token: TokenMetadata | null,
) {
  const { address } = useAccount()
  const config = useConfig()
  const { switchChainAsync } = useSwitchChain()
  const { signTypedDataAsync } = useSignTypedData()
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)

  async function renew() {
    if (!address || !renewal || !token) return
    setStep('signing')
    setError(null)
    try {
      const chainId = await prepareArcSigning(
        {
          chainId: () => Promise.resolve(getAccount(config).chainId),
          switchChain: (id) => switchChainAsync({ chainId: id }),
        },
        env.arcEnvironment,
      )
      const current = await readContract(config, {
        address: renewal.token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, renewal.spender],
      })
      const value = topUpAllowance(current, BigInt(renewal.suggestedAllowance))
      const nonce = BigInt(
        (await strimzBrowserClient().tokens.permitNonce(renewal.token, address)).nonce,
      )
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
      const typed = buildPermitTypedData({
        chainId,
        token: renewal.token,
        tokenName: token.name,
        tokenVersion: token.version,
        owner: address,
        spender: renewal.spender,
        value,
        nonce,
        deadline,
      })
      const signature = walletSignature(
        (await signTypedDataAsync(
          typed as Parameters<typeof signTypedDataAsync>[0],
        )) as `0x${string}`,
        await getBytecode(config, { address }),
      )
      setStep('submitting')
      const target = { kind: 'subscriptions' as const, id: subscriptionId }
      const submitted = await submitCheckoutRelay(
        target,
        { owner: address, value: value.toString(), deadline: deadline.toString(), signature },
        'allowance',
      )
      const started = Date.now()
      let status = submitted.status
      while (status !== 'confirmed') {
        if (status === 'reverted' || status === 'failed')
          throw new Error('The renewal did not go through.')
        if (Date.now() - started > POLL_LIMIT_MS)
          throw new Error('This is taking longer than usual.')
        await new Promise((r) => setTimeout(r, POLL_MS))
        const res = await fetch(checkoutSubmissionUrl(target, submitted.idempotencyKey), {
          cache: 'no-store',
        })
        if (res.ok) status = ((await res.json()) as { status: typeof status }).status
      }
      setStep('done')
    } catch (err) {
      setError((err as Error).message)
      setStep('failed')
    }
  }

  return { step, error, renew }
}
