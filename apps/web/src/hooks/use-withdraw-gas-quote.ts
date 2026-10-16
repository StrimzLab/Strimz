'use client'

import { useQuery } from '@tanstack/react-query'
import type { ConnectedWallet } from '@privy-io/react-auth'
import { createPublicClient, custom, encodeFunctionData, erc20Abi } from 'viem'

import { bufferedGasQuote, gasReserveUsdc, type GasQuote } from '@/lib/withdraw-gas'

export interface WithdrawGasQuote {
  quote: GasQuote
  reserve: bigint
}

export function useWithdrawGasQuote(input: {
  wallet: ConnectedWallet | null
  chainId: number
  token: `0x${string}` | undefined
  destination: `0x${string}` | null
}) {
  const { wallet, chainId, token, destination } = input
  return useQuery({
    queryKey: ['withdraw-gas-quote', chainId, wallet?.address, token, destination],
    enabled: Boolean(wallet && token && destination),
    refetchInterval: 15_000,
    queryFn: async (): Promise<WithdrawGasQuote> => {
      if (!wallet || !token || !destination) throw new Error('Withdraw gas quote needs a wallet')
      await wallet.switchChain(chainId)
      const provider = await wallet.getEthereumProvider()
      const client = createPublicClient({ transport: custom(provider) })
      const account = wallet.address as `0x${string}`
      const [gas, fees] = await Promise.all([
        client.estimateGas({
          account,
          to: token,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [destination, 1n],
          }),
        }),
        client.estimateFeesPerGas(),
      ])
      const quote = bufferedGasQuote({
        gas,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      })
      return { quote, reserve: gasReserveUsdc(quote) }
    },
  })
}
