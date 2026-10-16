'use client'

import * as React from 'react'
import { useWallets } from '@privy-io/react-auth'
import { encodeFunctionData, erc20Abi, isAddress } from 'viem'
import { toast } from 'sonner'
import type { RefundSigningInstructions } from '@strimz/shared-types'

import { browserRefundBroadcastMemory } from '@/lib/refund-broadcast'
import { useSubmitRefundSignature } from '@/hooks/api'

/**
 * Signs the ERC-20 transfer that constitutes the actual on-chain
 * refund. Uses the merchant's Privy embedded wallet (the same key
 * that owns the payout address). Once broadcast we POST the tx hash
 * back to `/v1/refunds/:id/signature` so the row flips from
 * `awaiting_signature` to `submitted` and the indexer takes over.
 */
export function useRefundSigner() {
  const { wallets } = useWallets()
  const submit = useSubmitRefundSignature()

  const embedded = React.useMemo(
    () => wallets.find((w) => w.walletClientType === 'privy') ?? null,
    [wallets],
  )

  const [broadcasting, setBroadcasting] = React.useState(false)

  const sign = React.useCallback(
    async ({
      refundId,
      instructions,
    }: {
      refundId: string
      instructions: RefundSigningInstructions
    }) => {
      if (!embedded) {
        toast.error('Connect your Strimz-embedded wallet before signing.')
        return null
      }
      if (!isAddress(instructions.to) || !isAddress(instructions.token)) {
        toast.error('Invalid signing instructions — refund not sent.')
        return null
      }
      const memory = browserRefundBroadcastMemory()
      if (!memory) {
        toast.warning(
          'Browser storage is unavailable. If submitting fails after you sign, do not sign again.',
        )
      }
      setBroadcasting(true)
      try {
        let hash = memory?.pending(refundId) ?? null
        if (hash) {
          toast.info('A transfer for this refund was already sent. Submitting its hash again.')
        } else {
          const data = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [instructions.to as `0x${string}`, BigInt(instructions.amount)],
          })
          const provider = await embedded.getEthereumProvider()
          hash = (await provider.request({
            method: 'eth_sendTransaction',
            params: [
              {
                from: embedded.address as `0x${string}`,
                to: instructions.token,
                data,
                value: '0x0',
              },
            ],
          })) as `0x${string}`
          memory?.remember(refundId, hash)
        }
        await submit.mutateAsync({ id: refundId, refundTxHash: hash })
        memory?.forget(refundId)
        return hash
      } finally {
        setBroadcasting(false)
      }
    },
    [embedded, submit],
  )

  return {
    sign,
    isSigning: broadcasting || submit.isPending,
    hasEmbeddedWallet: Boolean(embedded),
  }
}
