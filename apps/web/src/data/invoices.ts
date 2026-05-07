import { CUSTOMERS } from './customers'
import { daysAgo, id, mulberry32, pick, range } from './_seed'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void'

export type InvoiceLineItem = {
  description: string
  quantity: number
  unitAmountUsdc: number
}

export type Invoice = {
  id: string
  number: string
  customerName: string
  customerEmail: string
  customerCompany: string | null
  customerWallet: string
  status: InvoiceStatus
  lineItems: InvoiceLineItem[]
  subtotalUsdc: number
  totalUsdc: number
  note: string
  createdAt: string
  dueAt: string
  paidAt: string | null
  sessionId: string | null
}

const STATUSES: InvoiceStatus[] = [
  'paid',
  'paid',
  'paid',
  'sent',
  'sent',
  'overdue',
  'draft',
  'void',
]
const LINE_DESCRIPTIONS = [
  'Hosting (monthly)',
  'Premium support',
  'Pro seats × 5',
  'API overage',
  'Migration consulting',
  'Custom integration',
  'Implementation services',
  'SLA upgrade',
  'Compliance review',
  'Data import',
]
const NOTES = ['Net 14', 'Net 30', 'Due on receipt', 'Pay before next renewal']

const rng = mulberry32(67)

export const INVOICES: Invoice[] = range(28).map((i) => {
  const cust = CUSTOMERS[Math.floor(rng() * CUSTOMERS.length)]!
  const status = pick(rng, STATUSES)
  const itemCount = Math.floor(rng() * 3) + 1
  const lineItems: InvoiceLineItem[] = range(itemCount).map(() => ({
    description: pick(rng, LINE_DESCRIPTIONS),
    quantity: Math.floor(rng() * 5) + 1,
    unitAmountUsdc: Math.floor(rng() * 100_000_000) + 10_000_000,
  }))
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitAmountUsdc, 0)
  const created = Math.floor(rng() * 60)
  return {
    id: id('inv', i + 1),
    number: `2026-${String(i + 1).padStart(4, '0')}`,
    customerName: cust.name ?? cust.email?.split('@')[0] ?? 'Anonymous',
    customerEmail: cust.email ?? `${cust.walletAddress.slice(2, 8)}@strimz.finance`,
    customerCompany: cust.company,
    customerWallet: cust.walletAddress,
    status,
    lineItems,
    subtotalUsdc: subtotal,
    totalUsdc: subtotal,
    note: pick(rng, NOTES),
    createdAt: daysAgo(created + 14),
    dueAt: status === 'overdue' ? daysAgo(created + 21) : daysAgo(created),
    paidAt: status === 'paid' ? daysAgo(Math.max(0, created - 1)) : null,
    sessionId: status !== 'draft' ? id('sess', 1000 + i) : null,
  }
})
