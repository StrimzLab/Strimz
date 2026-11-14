import { buildPermitTypedData, buildSubscriptionIntentTypedData } from '@strimz/sdk/eip712'
import { subscriptionIntentNonce } from '@strimz/shared-crypto/checkout'

type Hex = `0x${string}`

export interface SubscriptionSigningInput {
  chainId: number
  subscriptionsAddress: Hex
  token: { address: Hex; name: string; version: string }
  payer: Hex
  planId: string
  merchantId: bigint
  amount: bigint
  interval: number
  startAt: bigint
  endAt: bigint
  permitValue: bigint
  permitNonce: bigint
  deadline: bigint
}

export interface SubscriptionRelayBody {
  merchantId: string
  token: Hex
  amount: string
  interval: number
  startAt: string
  endAt: string
  nonce: Hex
  permitData: { owner: Hex; value: string; deadline: string }
  permitSignature: Hex
  intentSignature: Hex
}

export function subscriptionSigningRequest(input: SubscriptionSigningInput) {
  const nonce = subscriptionIntentNonce(input.planId, input.payer, input.permitNonce)
  const permit = buildPermitTypedData({
    chainId: input.chainId,
    token: input.token.address,
    tokenName: input.token.name,
    tokenVersion: input.token.version,
    owner: input.payer,
    spender: input.subscriptionsAddress,
    value: input.permitValue,
    nonce: input.permitNonce,
    deadline: input.deadline,
  })
  const intent = buildSubscriptionIntentTypedData({
    chainId: input.chainId,
    verifyingContract: input.subscriptionsAddress,
    merchantId: input.merchantId,
    token: input.token.address,
    amount: input.amount,
    interval: input.interval,
    startAt: input.startAt,
    endAt: input.endAt,
    permitDeadline: input.deadline,
    permitValue: input.permitValue,
    nonce,
  })
  const body = (permitSignature: Hex, intentSignature: Hex): SubscriptionRelayBody => ({
    merchantId: input.merchantId.toString(),
    token: input.token.address,
    amount: input.amount.toString(),
    interval: input.interval,
    startAt: input.startAt.toString(),
    endAt: input.endAt.toString(),
    nonce,
    permitData: {
      owner: input.payer,
      value: input.permitValue.toString(),
      deadline: input.deadline.toString(),
    },
    permitSignature,
    intentSignature,
  })
  return { permit, intent, body }
}
