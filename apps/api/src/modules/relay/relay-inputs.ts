import type { EnrolmentRelayBody, PaymentRelayBody } from './relay.dto.js'
import type { PayWithAuthorizationInput, PermitAndCreateSubscriptionInput } from './relay.types.js'

export function paymentRelayInput(
  body: PaymentRelayBody,
  target: { merchantInternalId: string; sessionId: string },
): PayWithAuthorizationInput {
  return {
    idempotencyKey: body.idempotencyKey,
    merchantId: body.merchantId,
    token: body.token as `0x${string}`,
    auth: {
      from: body.auth.from as `0x${string}`,
      amount: body.auth.amount,
      validAfter: body.auth.validAfter,
      validBefore: body.auth.validBefore,
      nonce: body.auth.nonce as `0x${string}`,
    },
    ref: body.ref as `0x${string}`,
    authSignature: body.authSignature,
    intentSignature: body.intentSignature,
    merchantInternalId: target.merchantInternalId,
    sessionId: target.sessionId,
  }
}

export function enrolmentRelayInput(
  body: EnrolmentRelayBody,
  target: { merchantInternalId: string; subscriptionInternalId: string },
): PermitAndCreateSubscriptionInput {
  return {
    idempotencyKey: body.idempotencyKey,
    merchantId: body.merchantId,
    token: body.token as `0x${string}`,
    amount: body.amount,
    interval: body.interval,
    startAt: body.startAt,
    endAt: body.endAt,
    nonce: body.nonce as `0x${string}`,
    permitData: {
      owner: body.permitData.owner as `0x${string}`,
      value: body.permitData.value,
      deadline: body.permitData.deadline,
    },
    permitSignature: body.permitSignature,
    intentSignature: body.intentSignature,
    merchantInternalId: target.merchantInternalId,
    subscriptionInternalId: target.subscriptionInternalId,
  }
}
