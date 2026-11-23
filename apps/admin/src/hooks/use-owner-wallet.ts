'use client'

import { useConnectWallet, useWallets } from '@privy-io/react-auth'
import { getAddress, type Address, type Hex } from 'viem'

import {
  safeTxTypedData,
  typedDataJson,
  type SafeTxFields,
} from '@strimz/web-shared/lib/safe-console'

// The owner's own wallet (MetaMask or a hardware wallet), linked through Privy. Never the
// embedded wallet: Safe owners are separate keys (ADR-2026-11-23-safe-console).
export function useOwnerWallet() {
  const { wallets, ready } = useWallets()
  const { connectWallet } = useConnectWallet()
  const wallet = wallets.find((w) => w.connectorType !== 'embedded') ?? null
  const address: Address | null = wallet ? getAddress(wallet.address) : null

  async function provider(chainId: number) {
    if (!wallet) throw new Error('Connect your owner wallet first.')
    await wallet.switchChain(chainId)
    return wallet.getEthereumProvider()
  }

  async function signSafeTx(chainId: number, safe: Address, tx: SafeTxFields): Promise<Hex> {
    const p = await provider(chainId)
    return (await p.request({
      method: 'eth_signTypedData_v4',
      params: [address, typedDataJson(safeTxTypedData(chainId, safe, tx))],
    })) as Hex
  }

  // Only the guardian sends from its own wallet; the contracts check who sends a pause.
  async function send(chainId: number, to: Address, data: Hex): Promise<Hex> {
    const p = await provider(chainId)
    return (await p.request({
      method: 'eth_sendTransaction',
      params: [{ from: address, to, data }],
    })) as Hex
  }

  return { ready, address, connect: () => connectWallet(), signSafeTx, send }
}
