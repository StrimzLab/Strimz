import { Inject, Injectable } from '@nestjs/common'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  http,
  keccak256,
  TransactionReceiptNotFoundError,
  type Address,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type Transport,
} from 'viem'
import { getArcChain } from '@strimz/shared-config'
import { toSignerAccount, type TransactionSigner } from '@strimz/signer'

import { TypedConfigService } from '../../config/index.js'
import { REFUND_SIGNER } from './refund-signer.js'

export type BroadcastOutcome = 'sent' | 'known' | 'nonce_used'

function refundWallet(
  account: LocalAccount,
  environment: 'testnet' | 'mainnet',
  transport: Transport,
) {
  return createWalletClient({ account, chain: getArcChain(environment), transport })
}

/** The refund wallet: plain ERC-20 transfers, signed and stored before they are sent. */
@Injectable()
export class RefundChainService {
  private readonly client: PublicClient
  private readonly account: LocalAccount | null
  private readonly wallet: ReturnType<typeof refundWallet> | null

  constructor(cfg: TypedConfigService, @Inject(REFUND_SIGNER) signer: TransactionSigner | null) {
    const chain = getArcChain(cfg.env.ARC_ENVIRONMENT)
    const transport = http(cfg.env.ARC_RPC_URL)
    this.client = createPublicClient({ chain, transport }) as PublicClient
    this.account = signer ? toSignerAccount(signer) : null
    this.wallet = this.account
      ? refundWallet(this.account, cfg.env.ARC_ENVIRONMENT, transport)
      : null
  }

  get address(): Address | null {
    return this.account?.address ?? null
  }

  tokenBalance(token: Address): Promise<bigint> {
    return this.client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [this.requireAccount().address],
    })
  }

  nextNonce(): Promise<number> {
    return this.client.getTransactionCount({
      address: this.requireAccount().address,
      blockTag: 'pending',
    })
  }

  minedNonce(): Promise<number> {
    return this.client.getTransactionCount({
      address: this.requireAccount().address,
      blockTag: 'latest',
    })
  }

  async signTransfer(input: {
    token: Address
    to: Address
    amount: bigint
    nonce: number
  }): Promise<{ signedTx: Hex; txHash: Hex }> {
    const account = this.requireAccount()
    if (!this.wallet) throw new Error('no refund wallet configured')
    const request = await this.wallet.prepareTransactionRequest({
      account,
      to: input.token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [input.to, input.amount],
      }),
      nonce: input.nonce,
    })
    const signedTx = await this.wallet.signTransaction(request)
    return { signedTx, txHash: keccak256(signedTx) }
  }

  async broadcast(signedTx: Hex): Promise<BroadcastOutcome> {
    try {
      await this.client.sendRawTransaction({ serializedTransaction: signedTx })
      return 'sent'
    } catch (err) {
      const message = (err as Error).message.toLowerCase()
      if (message.includes('already known')) return 'known'
      if (message.includes('nonce too low')) return 'nonce_used'
      throw err
    }
  }

  async receiptStatus(txHash: Hex): Promise<'success' | 'reverted' | null> {
    try {
      const receipt = await this.client.getTransactionReceipt({ hash: txHash })
      return receipt.status
    } catch (err) {
      if (err instanceof TransactionReceiptNotFoundError) return null
      throw err
    }
  }

  private requireAccount(): LocalAccount {
    if (!this.account) throw new Error('no refund wallet configured')
    return this.account
  }
}
