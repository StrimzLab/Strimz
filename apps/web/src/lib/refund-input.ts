import {
  idSchema,
  type CreateRefundInput,
  type PaymentCurrency,
  type RefundReason,
} from '@strimz/shared-types'

import { formatTokenAmount } from '@/lib/format'
import { parseTokenAmountInput } from '@/lib/token-amount-input'

export type RefundInputResult =
  | { ok: true; input: CreateRefundInput }
  | { ok: false; error: string }

export function buildRefundInput(args: {
  transactionId: string
  amount: string
  currency: PaymentCurrency
  maxAmount: string | null
  reason: RefundReason
  note: string
}): RefundInputResult {
  const transactionId = args.transactionId.trim()
  if (!idSchema.safeParse(transactionId).success) {
    return { ok: false, error: 'Enter the original transaction ID' }
  }

  const parsed = parseTokenAmountInput(args.amount, args.currency, 'Enter the amount to refund')
  if (!parsed.ok) return parsed
  const amount = parsed.amount
  if (amount <= 0n) return { ok: false, error: 'Enter an amount above 0' }
  if (args.maxAmount !== null && amount > BigInt(args.maxAmount)) {
    return {
      ok: false,
      error: `Enter at most ${formatTokenAmount(args.maxAmount, args.currency)}, the transaction amount`,
    }
  }

  const note = args.note.trim()
  return {
    ok: true,
    input: {
      transactionId,
      amount: amount.toString(),
      reason: args.reason,
      ...(note ? { note } : {}),
    },
  }
}
