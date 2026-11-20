import {
  buildPayIntentTypedData,
  buildPermitTypedData,
  buildReceiveWithAuthorizationTypedData,
  buildSubscriptionIntentTypedData,
} from '@strimz/sdk/eip712'
import { ARC_TESTNET_CHAIN_ID } from '@strimz/shared-config'
import { checkoutPaymentNonce, subscriptionIntentNonce } from '@strimz/shared-crypto/checkout'
import { maxUint256, stringToHex, type Address, type Hex } from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { z } from 'zod'
import {
  deployment,
  eventually,
  merchant,
  publicGet,
  publicPost,
  strimz,
  submissionSchema,
  TERMINAL,
  type Submission,
  actors,
} from './support.js'

const tokenSchema = z.object({ name: z.string(), version: z.string() })
const termsSchema = z.object({ startAt: z.string().regex(/^[0-9]+$/u) })
const nonceSchema = z.object({ nonce: z.string().regex(/^[0-9]+$/u) })

export const payer = privateKeyToAccount(actors.payer.privateKey)

export interface Signer {
  account: PrivateKeyAccount
  onchainMerchantId: number
}

const defaultSigner = (): Signer => ({
  account: payer,
  onchainMerchantId: merchant.onchainMerchantId,
})

let tokenMeta: Promise<z.output<typeof tokenSchema>> | undefined
export function usdcMeta() {
  tokenMeta ??= publicGet(`/v1/tokens/${deployment.usdc}`, tokenSchema)
  return tokenMeta
}

export interface RelayBody {
  merchantId: string
  token: Address
  auth: { from: Address; amount: string; validAfter: string; validBefore: string; nonce: Hex }
  ref: Hex
  authSignature: Hex
  intentSignature: Hex
}

// Mirrors apps/web/src/hooks/use-pay-checkout.ts, which is what a real payer's wallet signs.
export async function signCheckout(
  sessionId: string,
  amount: bigint,
  validForSeconds: number,
  signer: Signer = defaultSigner(),
): Promise<RelayBody> {
  const token = await usdcMeta()
  const who = signer.account
  const now = Math.floor(Date.now() / 1000)
  const validAfter = BigInt(now - 60)
  const validBefore = BigInt(now + validForSeconds)
  const nonce = checkoutPaymentNonce(sessionId)
  const ref = stringToHex(sessionId, { size: 32 })
  const merchantId = BigInt(signer.onchainMerchantId)

  const authSignature = await who.signTypedData(
    buildReceiveWithAuthorizationTypedData({
      chainId: ARC_TESTNET_CHAIN_ID,
      token: deployment.usdc,
      tokenName: token.name,
      tokenVersion: token.version,
      from: who.address,
      to: deployment.payments,
      value: amount,
      validAfter,
      validBefore,
      nonce,
    }),
  )
  const intentSignature = await who.signTypedData(
    buildPayIntentTypedData({
      chainId: ARC_TESTNET_CHAIN_ID,
      verifyingContract: deployment.payments,
      merchantId,
      token: deployment.usdc,
      amount,
      nonce,
      validBefore,
      ref,
    }),
  )

  return {
    merchantId: merchantId.toString(),
    token: deployment.usdc,
    auth: {
      from: who.address,
      amount: amount.toString(),
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce,
    },
    ref,
    authSignature,
    intentSignature,
  }
}

export async function relayCheckout(sessionId: string, body: RelayBody): Promise<Submission> {
  const submitted = await publicPost(`/v1/checkout/sessions/${sessionId}/relay`, body)
  if (TERMINAL.has(submitted.status)) return submitted
  const key = submitted.idempotencyKey
  return eventually(
    `relay submission ${key}`,
    () => publicGet(`/v1/checkout/sessions/${sessionId}/submissions/${key}`, submissionSchema),
    (s) => TERMINAL.has(s.status),
  )
}

export async function payViaCheckout(
  amount: bigint,
): Promise<{ sessionId: string; body: RelayBody; submission: Submission }> {
  const session = await strimz.paymentSessions.create({
    amount: amount.toString(),
    currency: 'USDC',
    description: 'full-stack e2e',
  })
  const body = await signCheckout(session.id, amount, 5 * 60)
  const submission = await relayCheckout(session.id, body)
  return { sessionId: session.id, body, submission }
}

// Mirrors apps/web/src/hooks/use-subscription-checkout.ts and lib/subscription-signing.ts.
export async function signEnrolment(
  planId: string,
  amount: bigint,
  intervalSeconds: number,
  signer: Signer = defaultSigner(),
  permitValue: bigint = maxUint256,
) {
  const payer = signer.account
  const token = await usdcMeta()
  const terms = await publicGet(
    `/v1/checkout/plans/${planId}/terms?payer=${payer.address}`,
    termsSchema,
  )
  const { nonce: permitNonceRaw } = await publicGet(
    `/v1/tokens/${deployment.usdc}/permit-nonce?owner=${payer.address}`,
    nonceSchema,
  )
  const permitNonce = BigInt(permitNonceRaw)
  const startAt = BigInt(terms.startAt)
  const endAt = 0n
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60)
  const merchantId = BigInt(signer.onchainMerchantId)
  const nonce = subscriptionIntentNonce(planId, payer.address, permitNonce)

  const permitSignature = await payer.signTypedData(
    buildPermitTypedData({
      chainId: ARC_TESTNET_CHAIN_ID,
      token: deployment.usdc,
      tokenName: token.name,
      tokenVersion: token.version,
      owner: payer.address,
      spender: deployment.subscriptions,
      value: permitValue,
      nonce: permitNonce,
      deadline,
    }),
  )
  const intentSignature = await payer.signTypedData(
    buildSubscriptionIntentTypedData({
      chainId: ARC_TESTNET_CHAIN_ID,
      verifyingContract: deployment.subscriptions,
      merchantId,
      token: deployment.usdc,
      amount,
      interval: intervalSeconds,
      startAt,
      endAt,
      permitDeadline: deadline,
      permitValue,
      nonce,
    }),
  )

  return {
    merchantId: merchantId.toString(),
    token: deployment.usdc,
    amount: amount.toString(),
    interval: intervalSeconds,
    startAt: startAt.toString(),
    endAt: endAt.toString(),
    nonce,
    permitData: {
      owner: payer.address,
      value: permitValue.toString(),
      deadline: deadline.toString(),
    },
    permitSignature,
    intentSignature,
  }
}
