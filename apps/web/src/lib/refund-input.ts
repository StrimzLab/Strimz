import { parseUnits } from 'viem'
import { TOKENS } from '@strimz/shared-config'
import {
  idSchema,
  type CreateRefundInput,
  type PaymentCurrency,
  type RefundReason,
} from '@strimz/shared-types'

import { formatTokenAmount } from '@/lib/format'

export type RefundInputResult =
  | { ok: true; input: CreateRefundInput }
  | { ok: false; error: string }

const DECIMAL = /^\d+(\.\d+)?$/u

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

  const amountText = args.amount.trim()
  if (amountText === '') return { ok: false, error: 'Enter the amount to refund' }
  if (!DECIMAL.test(amountText)) return { ok: false, error: 'Enter a valid amount' }
  const decimals = TOKENS[args.currency].decimals
  if ((amountText.split('.')[1] ?? '').length > decimals) {
    return { ok: false, error: `Enter at most ${decimals} decimal places` }
  }
  const amount = parseUnits(amountText, decimals)
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
