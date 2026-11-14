import { arcTestnet } from '@strimz/shared-config'
import {
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  keccak256,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { payViaCheckout } from './flows.js'
import {
  chain,
  db,
  deployment,
  eventually,
  merchant,
  strimz,
  usdcBalance,
  actors,
} from './support.js'

const PAYMENT = 3_000_000n // 3 USDC
const REFUND = 1_000_000n // 1 USDC

// The payout wallet holds the merchant's funds, so it is the wallet that signs refunds.
const payoutWallet = createWalletClient({
  account: privateKeyToAccount(actors.payout.privateKey),
  chain: arcTestnet,
  transport: http(deployment.rpcUrl),
})

async function signedTransfer(to: Address, amount: bigint): Promise<{ raw: Hex; hash: Hex }> {
  const request = await payoutWallet.prepareTransactionRequest({
    to: deployment.usdc,
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amount] }),
  })
  const raw = await payoutWallet.signTransaction(request)
  return { raw, hash: keccak256(raw) }
}

async function indexerPassed(block: bigint): Promise<void> {
  await eventually(
    `indexer past block ${block}`,
    () => db().indexerCursor.findMany(),
    (cursors) => cursors.length > 0 && cursors.every((c) => c.lastProcessedBlock >= block),
  )
}

function refundEvent(refundId: string) {
  return db().webhookEvent.findFirst({
    where: {
      merchantId: merchant.id,
      type: 'refund_completed',
      payload: { path: ['data', 'refund', 'id'], equals: refundId },
    },
    include: { deliveries: true },
  })
}

describe('merchant refund', () => {
  let transactionId: string

  beforeAll(async () => {
    const { sessionId, submission } = await payViaCheckout(PAYMENT)
    expect(submission.status).toBe('confirmed')
    const tx = await eventually(
      'payment transaction row',
      () => db().transaction.findFirst({ where: { sessionId } }),
      (t) => t?.status === 'confirmed',
    )
    if (!tx) throw new Error('no transaction for the refund to target')
    transactionId = tx.id
  })

  afterAll(async () => {
    await db().$disconnect()
  })

  it('completes when the hash is submitted before the transfer lands', async () => {
    const { refund, signingInstructions } = await strimz.refunds.create({
      transactionId,
      amount: REFUND.toString(),
      reason: 'customer_request',
    })
    expect(refund.status).toBe('awaiting_signature')
    expect(signingInstructions.to.toLowerCase()).toBe(actors.payer.address.toLowerCase())

    const payerBefore = await usdcBalance(actors.payer.address)
    const transfer = await signedTransfer(
      getAddress(signingInstructions.to),
      BigInt(signingInstructions.amount),
    )
    await strimz.refunds.submitSignature({ id: refund.id, refundTxHash: transfer.hash })
    await chain.waitForTransactionReceipt({
      hash: await chain.sendRawTransaction({ serializedTransaction: transfer.raw }),
    })

    const done = await eventually(
      'refund completed',
      () => strimz.refunds.retrieve(refund.id),
      (r) => r.status === 'completed',
    )
    expect(done.refundTxHash).toBe(transfer.hash)
    expect((await usdcBalance(actors.payer.address)) - payerBefore).toBe(REFUND)
    const event = await eventually(
      'refund.completed dispatched',
      () => refundEvent(refund.id),
      (e) => e?.dispatchedAt != null && e.deliveries.length === 1,
    )
    expect(event?.deliveries[0]?.endpointId).toBe(merchant.webhookEndpointId)
  })

  // The order apps/web/content/docs/guides/refunds.mdx tells merchants to use:
  // send the transfer, then post its hash. On Arc the block is final in under a
  // second, so the indexer can pass it before the hash arrives.
  it('completes when the hash is submitted after the indexer has seen the transfer', async () => {
    const { refund, signingInstructions } = await strimz.refunds.create({
      transactionId,
      amount: REFUND.toString(),
      reason: 'customer_request',
    })
    const hash = await payoutWallet.writeContract({
      address: deployment.usdc,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [getAddress(signingInstructions.to), BigInt(signingInstructions.amount)],
    })
    const receipt = await chain.waitForTransactionReceipt({ hash })
    await indexerPassed(receipt.blockNumber)

    await strimz.refunds.submitSignature({ id: refund.id, refundTxHash: hash })

    const done = await eventually(
      'refund completed',
      () => strimz.refunds.retrieve(refund.id),
      (r) => r.status === 'completed',
      30_000,
    )
    expect(done.refundTxHash).toBe(hash)
  })
})
