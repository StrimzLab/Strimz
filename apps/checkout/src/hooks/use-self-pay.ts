'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  estimateGas,
  getAccount,
  getGasPrice,
  sendTransaction,
  waitForTransactionReceipt,
} from '@wagmi/core'
import { useConfig, useSwitchChain } from 'wagmi'
import { prepareArcSigning } from '@strimz/web-shared/lib/arc-network'
import { env } from '@strimz/web-shared/lib/env'

import type { SelfPayCall } from '@/lib/checkout-submission'
import { formatNetworkFee, selfPayErrorMessage } from '@/lib/self-pay'

export interface SelfPayResult {
  txHash: `0x${string}`
  status: 'success' | 'reverted'
}

export interface SelfPayState {
  fee: string | null
  sending: boolean
  error: string | null
  send: () => Promise<SelfPayResult | null>
}

/** Sends a payer-signed call from the payer's own wallet, which then pays the network fee. */
export function useSelfPay(call: SelfPayCall | null): SelfPayState {
  const config = useConfig()
  const { switchChainAsync } = useSwitchChain()
  const [fee, setFee] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFee(null)
    setError(null)
    if (!call) return
    let stale = false
    const account = getAccount(config).address
    void Promise.all([
      estimateGas(config, { account, to: call.to, data: call.data, chainId: call.chainId }),
      getGasPrice(config, { chainId: call.chainId }),
    ])
      .then(([gas, price]) => {
        if (!stale) setFee(formatNetworkFee(gas, price))
      })
      .catch((err: unknown) => {
        console.error('[checkout] network fee estimate failed', err)
      })
    return () => {
      stale = true
    }
  }, [call, config])

  const send = useCallback(async (): Promise<SelfPayResult | null> => {
    if (!call || sending) return null
    setSending(true)
    setError(null)
    try {
      await prepareArcSigning(
        {
          chainId: () => Promise.resolve(getAccount(config).chainId),
          switchChain: (id) => switchChainAsync({ chainId: id }),
        },
        env.arcEnvironment,
      )
      const hash = await sendTransaction(config, {
        to: call.to,
        data: call.data,
        chainId: call.chainId,
      })
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: call.chainId })
      return { txHash: hash, status: receipt.status }
    } catch (err) {
      console.error('[checkout] self-pay failed', err)
      setError(selfPayErrorMessage(err))
      return null
    } finally {
      setSending(false)
    }
  }, [call, config, sending, switchChainAsync])

  return { fee, sending, error, send }
}
