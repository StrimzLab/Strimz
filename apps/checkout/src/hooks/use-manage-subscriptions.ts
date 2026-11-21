'use client'

import { useCallback, useReducer } from 'react'
import { useAccount, useConfig, useSignTypedData, useSwitchChain } from 'wagmi'
import { getAccount, getBytecode } from '@wagmi/core'
import {
  buildCancelSubscriptionTypedData,
  buildViewSubscriptionsTypedData,
} from '@strimz/sdk/eip712'

import { prepareArcSigning } from '@strimz/web-shared/lib/arc-network'
import { env } from '@strimz/web-shared/lib/env'
import { checkoutSubmissionUrl, type RelaySubmissionView } from '@/lib/checkout-submission'
import {
  cancelManagedSubscription,
  initialManageState,
  listManagedSubscriptions,
  manageReducer,
  type ManagedSubscription,
} from '@/lib/manage-subscriptions'
import { walletSignature } from '@/lib/wallet-signature'

const POLL_MS = 1500
const POLL_LIMIT_MS = 180_000
const CANCEL_VALID_SECONDS = 1800n

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function useManageSubscriptions() {
  const { address } = useAccount()
  const config = useConfig()
  const { switchChainAsync } = useSwitchChain()
  const { signTypedDataAsync } = useSignTypedData()
  const [state, dispatch] = useReducer(manageReducer, initialManageState)
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  async function sign(typed: unknown): Promise<`0x${string}`> {
    if (!address) throw new Error('Connect your wallet first.')
    const raw = (await signTypedDataAsync(
      typed as Parameters<typeof signTypedDataAsync>[0],
    )) as `0x${string}`
    return walletSignature(raw, await getBytecode(config, { address }))
  }

  function arcChainId(): Promise<number> {
    return prepareArcSigning(
      {
        chainId: () => Promise.resolve(getAccount(config).chainId),
        switchChain: (id) => switchChainAsync({ chainId: id }),
      },
      env.arcEnvironment,
    )
  }

  async function signIn() {
    if (!address) return
    dispatch({ type: 'signing_in' })
    try {
      const chainId = await arcChainId()
      const issuedAt = BigInt(Math.floor(Date.now() / 1000))
      const signature = await sign(
        buildViewSubscriptionsTypedData({ chainId, payer: address, issuedAt }),
      )
      const view = await listManagedSubscriptions({ payer: address, issuedAt, signature })
      dispatch({ type: 'loaded', view })
    } catch (err) {
      dispatch({ type: 'load_failed', message: friendly(err) })
    }
  }

  async function cancel(sub: ManagedSubscription) {
    if (!state.view) return
    dispatch({ type: 'cancel_started', subscriptionId: sub.subscriptionId })
    try {
      await arcChainId()
      const deadline = BigInt(Math.floor(Date.now() / 1000)) + CANCEL_VALID_SECONDS
      const signature = await sign(
        buildCancelSubscriptionTypedData({
          chainId: state.view.chainId,
          verifyingContract: state.view.subscriptionsAddress,
          subscriptionId: BigInt(sub.onchainSubscriptionId),
          deadline,
        }),
      )
      const submitted = await cancelManagedSubscription(sub.subscriptionId, { deadline, signature })
      await waitForConfirmation(sub.subscriptionId, submitted)
      await waitForCancelled(sub.subscriptionId)
      dispatch({ type: 'cancel_confirmed', subscriptionId: sub.subscriptionId })
    } catch (err) {
      dispatch({ type: 'cancel_failed', message: friendly(err) })
    }
  }

  return {
    state,
    signIn,
    cancel,
    reset,
  }
}

async function waitForConfirmation(subscriptionId: string, submitted: RelaySubmissionView) {
  const target = { kind: 'subscriptions' as const, id: subscriptionId }
  const started = Date.now()
  let status = submitted.status
  while (status !== 'confirmed') {
    if (status === 'reverted' || status === 'failed') {
      throw new Error('The cancel did not go through. Try again.')
    }
    if (Date.now() - started > POLL_LIMIT_MS) {
      throw new Error('This is taking longer than usual. Check again in a few minutes.')
    }
    await sleep(POLL_MS)
    const res = await fetch(checkoutSubmissionUrl(target, submitted.idempotencyKey), {
      cache: 'no-store',
    })
    if (res.ok) status = ((await res.json()) as { status: typeof status }).status
  }
}

// The chain has confirmed it; wait until Strimz has recorded it too.
async function waitForCancelled(subscriptionId: string) {
  const started = Date.now()
  while (Date.now() - started < POLL_LIMIT_MS) {
    const res = await fetch(
      `${env.apiUrl}/v1/checkout/subscriptions/${encodeURIComponent(subscriptionId)}/renewal`,
      { cache: 'no-store' },
    )
    if (res.ok && ((await res.json()) as { status: string }).status === 'cancelled') return
    await sleep(POLL_MS)
  }
  throw new Error(
    'Your cancel went through, but this page has not caught up yet. Refresh in a minute.',
  )
}

function friendly(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/user rejected|denied|rejected the request/iu.test(message)) {
    return 'You declined the signature in your wallet. Nothing changed.'
  }
  return message
}
