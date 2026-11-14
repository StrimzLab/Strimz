import type { PrismaClient, WebhookEventName } from '@strimz/db'
import { arcTestnet, PLANS } from '@strimz/shared-config'
import { encryptAesGcm, generateApiKey, randomBase64Url, sha256Hex } from '@strimz/shared-crypto'
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Actors, Deployment } from './chain.js'

const registryAbi = parseAbi([
  'function nextMerchantId() view returns (uint256)',
  'function registerMerchant(address owner, address payoutAddress, uint16 feeBps, uint16 maxFeeBps, uint256 parentMerchantId) returns (uint256)',
])

export const MERCHANT_TIER = 'starter' as const

export interface SeededMerchant {
  id: string
  onchainMerchantId: number
  feeBps: number
  secretKey: string
  webhookEndpointId: string
}

// The relayer holds MERCHANT_REGISTRAR_ROLE after the handoff, as in production.
async function registerOnChain(d: Deployment, actors: Actors, feeBps: number): Promise<number> {
  const account = privateKeyToAccount(actors.relayer.privateKey)
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http(d.rpcUrl) })
  const wallet = createWalletClient({ account, chain: arcTestnet, transport: http(d.rpcUrl) })
  const id = await publicClient.readContract({
    address: d.registry,
    abi: registryAbi,
    functionName: 'nextMerchantId',
  })
  const hash = await wallet.writeContract({
    address: d.registry,
    abi: registryAbi,
    functionName: 'registerMerchant',
    args: [actors.merchant.address, actors.payout.address, feeBps, feeBps, 0n],
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`registerMerchant reverted in ${hash}`)
  return Number(id)
}

const ENDPOINT_EVENTS: WebhookEventName[] = [
  'payment_completed',
  'subscription_created',
  'subscription_charged',
  'subscription_cancelled',
  'refund_completed',
]

// A loopback URL: the scheduler's target policy must refuse it, so nothing leaves the machine.
export const WEBHOOK_URL = 'http://127.0.0.1:9/strimz-e2e'

export async function seedMerchant(
  prisma: PrismaClient,
  d: Deployment,
  actors: Actors,
  webhookEncryptionKey: string,
): Promise<SeededMerchant> {
  const feeBps = PLANS[MERCHANT_TIER].feeBps
  if (feeBps === null) throw new Error(`${MERCHANT_TIER} has no fixed fee`)
  const onchainMerchantId = await registerOnChain(d, actors, feeBps)

  const merchant = await prisma.merchant.create({
    data: {
      privyUserId: `did:privy:e2e-${onchainMerchantId}`,
      email: `merchant-${onchainMerchantId}@strimz.test`,
      emailVerified: true,
      onboardingCompleted: true,
      businessName: 'Full Stack Co',
      walletAddress: actors.merchant.address.toLowerCase(),
      payoutAddress: actors.payout.address.toLowerCase(),
      onchainMerchantId,
      tier: MERCHANT_TIER,
    },
  })

  const key = await generateApiKey('secret', 'test')
  await prisma.merchantApiKey.create({
    data: {
      merchantId: merchant.id,
      name: 'full-stack e2e',
      hash: key.hash,
      prefix: key.prefix,
      lastFour: key.lastFour,
      kind: 'secret',
      mode: 'test',
      scopes: [
        'sessions_read',
        'sessions_write',
        'subscriptions_read',
        'subscriptions_write',
        'refunds_read',
        'refunds_write',
        'relay_read',
        'relay_write',
      ],
    },
  })

  const secret = `whsec_${randomBase64Url(32)}`
  const endpoint = await prisma.merchantWebhookEndpoint.create({
    data: {
      merchantId: merchant.id,
      url: WEBHOOK_URL,
      events: ENDPOINT_EVENTS,
      mode: 'test',
      status: 'active',
      signingSecretHash: await sha256Hex(secret),
      signingSecretPrefix: secret.slice(0, 12),
      signingSecretCiphertext: await encryptAesGcm(secret, webhookEncryptionKey),
    },
  })

  return {
    id: merchant.id,
    onchainMerchantId,
    feeBps,
    secretKey: key.secret,
    webhookEndpointId: endpoint.id,
  }
}
