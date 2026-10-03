import { formatTokenAmount, shortAddress } from './format'

export interface ConfirmCopy {
  title: string
  description: string
  confirmLabel: string
}

export function revokeApiKeyConfirm(key: { name: string; prefix: string; mode: string }) {
  return {
    title: `Revoke API key "${key.name}"?`,
    description: `Every ${key.mode} request signed with ${key.prefix}… will be rejected from now on. Anything still using this key stops working. This cannot be undone.`,
    confirmLabel: 'Revoke key',
  } satisfies ConfirmCopy
}

export function voidInvoiceConfirm(invoice: { number: string; total: string; currency: string }) {
  return {
    title: `Void invoice ${invoice.number}?`,
    description: `The customer can no longer pay ${formatTokenAmount(invoice.total, invoice.currency)} on this invoice and its payment link stops working. This cannot be undone.`,
    confirmLabel: 'Void invoice',
  } satisfies ConfirmCopy
}

export function cancelSubscriptionConfirm(sub: { amount: string; currency: string }) {
  return {
    title: 'Cancel this subscription?',
    description: `The subscription is cancelled immediately and the ${formatTokenAmount(sub.amount, sub.currency)} recurring charge is not collected again. The customer has to subscribe again to restart it.`,
    confirmLabel: 'Cancel subscription',
  } satisfies ConfirmCopy
}

export function cancelPaymentSessionConfirm(session: { amount: string; currency: string }) {
  return {
    title: 'Cancel this payment session?',
    description: `The checkout link stops accepting the ${formatTokenAmount(session.amount, session.currency)} payment. This cannot be undone; create a new session to collect it.`,
    confirmLabel: 'Cancel session',
  } satisfies ConfirmCopy
}

export function suspendMerchantConfirm(merchant: { businessName: string }) {
  return {
    title: `Suspend ${merchant.businessName}?`,
    description: `Their API keys and dashboard access are refused until an admin reactivates the account, so they cannot create payments or manage billing. The change is audited.`,
    confirmLabel: 'Suspend merchant',
  } satisfies ConfirmCopy
}

export function suspendAdminConfirm(admin: { email: string }) {
  return {
    title: 'Suspend this admin?',
    description: `${admin.email} loses access to the admin console until a super admin reactivates them.`,
    confirmLabel: 'Suspend admin',
  } satisfies ConfirmCopy
}

export function removeAdminConfirm(admin: { email: string }) {
  return {
    title: 'Remove this admin?',
    description: `${admin.email} is suspended and loses access to the admin console. Removing an admin keeps their record, so a super admin can reactivate them later.`,
    confirmLabel: 'Remove admin',
  } satisfies ConfirmCopy
}

export function approveAgentJobConfirm(job: {
  amount: string
  currency: string
  vendorAddress: string
}) {
  return {
    title: 'Approve this agent job?',
    description: `Approving funds an on-chain escrow of ${formatTokenAmount(job.amount, job.currency)} for vendor ${shortAddress(job.vendorAddress)}. The job is created on-chain right away and cannot be withdrawn from the dashboard.`,
    confirmLabel: 'Approve and fund',
  } satisfies ConfirmCopy
}
