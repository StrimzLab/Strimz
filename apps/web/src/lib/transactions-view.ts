import type { Transaction, TransactionKind } from '@strimz/shared-types'

const KIND_LABELS: Record<TransactionKind, string> = {
  one_shot: 'Payment',
  subscription_charge: 'Subscription charge',
  refund: 'Refund',
  invoice_payment: 'Invoice payment',
  storefront_purchase: 'Storefront purchase',
}

export function transactionKindLabel(kind: TransactionKind): string {
  return KIND_LABELS[kind]
}

export function canRefund(tx: Pick<Transaction, 'kind' | 'status'>): boolean {
  return tx.status === 'confirmed' && tx.kind !== 'refund'
}
