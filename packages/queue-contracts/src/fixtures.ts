import type {
  AgentActionJob,
  CctpBridgeJob,
  RelayJob,
  SubscriptionDueJob,
  WebhookDeliveryJob,
} from './jobs.js'

export const agentActionJobFixtures: Record<AgentActionJob['type'], AgentActionJob> = {
  'subscription.cancel-onchain': {
    type: 'subscription.cancel-onchain',
    subscriptionId: 'sub_fixture',
    onchainSubscriptionId: 7,
    merchantId: 'm_fixture',
    reason: 'merchant initiated',
  },
  'job.create-onchain': { type: 'job.create-onchain', jobId: 'job_fixture' },
  'job.release-onchain': { type: 'job.release-onchain', jobId: 'job_fixture' },
  'job.dispute-onchain': {
    type: 'job.dispute-onchain',
    jobId: 'job_fixture',
    reason: 'quality issue',
  },
  'job.cancel-onchain': {
    type: 'job.cancel-onchain',
    jobId: 'job_fixture',
    reason: 'no longer needed',
  },
  'routing.cctp.settle': {
    type: 'routing.cctp.settle',
    merchantId: 'm_fixture',
    sourceDomainId: 6,
    sourceTxHash: `0x${'a'.repeat(64)}`,
    messageHex: `0x${'be'.repeat(80)}`,
    attestationHex: `0x${'12'.repeat(65)}`,
    ref: 'sess_fixture',
  },
}

export const webhookDeliveryJobFixture: WebhookDeliveryJob = {
  deliveryId: 'whdl_fixture',
  endpointId: 'ep_fixture',
  url: 'https://example.com/hook',
  signingSecretHash: 'a'.repeat(64),
  eventId: 'evt_fixture',
}

export const subscriptionDueJobFixture: SubscriptionDueJob = { subscriptionId: 'sub_fixture' }

export const cctpBridgeJobFixture: CctpBridgeJob = {
  merchantId: 'm_fixture',
  sourceDomainId: 6,
  sourceTxHash: `0x${'c'.repeat(64)}`,
  ref: 'sess_fixture',
  pollCount: 0,
}

export const relayJobFixtures: { [R in RelayJob['reason']]: Extract<RelayJob, { reason: R }> } = {
  payWithAuthorization: {
    reason: 'payWithAuthorization',
    idempotencyKey: 'sess_fixture',
    toAddress: '0x0000000000000000000000000000000000000a02',
    callData: '0xdeadbeef',
    gasLimit: '280000',
    merchantInternalId: 'm_fixture',
    sessionId: 'sess_fixture',
  },
  permitAndCreateSubscription: {
    reason: 'permitAndCreateSubscription',
    idempotencyKey: 'enrol_fixture',
    toAddress: '0x0000000000000000000000000000000000000a03',
    callData: '0xcafebabe',
    gasLimit: '320000',
    merchantInternalId: 'm_fixture',
    subscriptionInternalId: 'plan_fixture',
  },
  registerMerchant: {
    reason: 'registerMerchant',
    idempotencyKey: 'merchant-register:m_fixture',
    merchantInternalId: 'm_fixture',
  },
}
