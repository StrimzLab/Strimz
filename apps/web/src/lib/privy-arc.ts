import type { ConnectedWallet } from '@privy-io/react-auth'
import { hexToNumber, type Hex } from 'viem'

import type { SwitchableWallet } from './arc-network'

export function privySwitchableWallet(wallet: ConnectedWallet): SwitchableWallet {
  return {
    chainId: async () => {
      const provider = await wallet.getEthereumProvider()
      return hexToNumber((await provider.request({ method: 'eth_chainId' })) as Hex)
    },
    switchChain: (chainId) => wallet.switchChain(chainId),
  }
}
