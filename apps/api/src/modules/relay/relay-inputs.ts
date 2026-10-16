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
    authSignature: {
      v: body.authSignature.v,
      r: body.authSignature.r as `0x${string}`,
      s: body.authSignature.s as `0x${string}`,
    },
    intentSignature: {
      v: body.intentSignature.v,
      r: body.intentSignature.r as `0x${string}`,
      s: body.intentSignature.s as `0x${string}`,
    },
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
    permitData: {
      owner: body.permitData.owner as `0x${string}`,
      value: body.permitData.value,
      deadline: body.permitData.deadline,
    },
    permitSignature: {
      v: body.permitSignature.v,
      r: body.permitSignature.r as `0x${string}`,
      s: body.permitSignature.s as `0x${string}`,
    },
    intentSignature: {
      v: body.intentSignature.v,
      r: body.intentSignature.r as `0x${string}`,
      s: body.intentSignature.s as `0x${string}`,
    },
    merchantInternalId: target.merchantInternalId,
    subscriptionInternalId: target.subscriptionInternalId,
  }
}
