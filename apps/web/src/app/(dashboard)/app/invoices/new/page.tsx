'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { parseUnits } from 'viem'
import { toast } from 'sonner'
import type { CreateInvoiceInput, PaymentCurrency } from '@strimz/shared-types'
import {
  Button,
  Card,
  CardContent,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@strimz/ui'

import { PageHeader } from '@/components/dashboard/page-header'
import { useCreateInvoice } from '@/hooks/api'

interface LineItemDraft {
  description: string
  quantity: string
  unitAmount: string
}

const emptyLine = (): LineItemDraft => ({ description: '', quantity: '1', unitAmount: '' })

export default function NewInvoicePage() {
  const router = useRouter()
  const createMutation = useCreateInvoice()

  const [customerName, setCustomerName] = React.useState('')
  const [customerEmail, setCustomerEmail] = React.useState('')
  const [currency, setCurrency] = React.useState<PaymentCurrency>('USDC')
  const [dueDays, setDueDays] = React.useState('14')
  const [note, setNote] = React.useState('')
  const [lines, setLines] = React.useState<LineItemDraft[]>([emptyLine()])

  const totals = React.useMemo(() => {
    let subtotal = 0
    for (const li of lines) {
      const q = Number(li.quantity) || 0
      const p = Number(li.unitAmount) || 0
      subtotal += q * p
    }
    return { subtotal }
  }, [lines])

  const canSubmit =
    customerName.trim().length > 0 &&
    customerEmail.trim().length > 0 &&
    lines.length > 0 &&
    lines.every((l) => l.description.trim() && Number(l.quantity) > 0 && Number(l.unitAmount) > 0)

  const updateLine = (idx: number, patch: Partial<LineItemDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const addLine = () => setLines((prev) => [...prev, emptyLine()])
  const removeLine = (idx: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    let convertedLines: CreateInvoiceInput['lineItems']
    try {
      convertedLines = lines.map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unitAmount: parseUnits(l.unitAmount, 6).toString(),
      })) as CreateInvoiceInput['lineItems']
    } catch {
      toast.error('Check the unit amounts — one of them is not a valid number.')
      return
    }
    createMutation.mutate(
      {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        lineItems: convertedLines,
        currency,
        note: note.trim() || undefined,
        dueInDays: Math.max(1, Math.min(90, Number(dueDays) || 14)),
      },
      {
        onSuccess: (invoice) => {
          router.replace(`/app/invoices/${invoice.id}`)
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href="/app/invoices">
            <ArrowLeft className="mr-1.5 size-4" />
            Back to invoices
          </Link>
        </Button>
        <PageHeader
          title="New invoice"
          description="Bill a customer with any number of line items. Saves as a draft you can send from the row menu."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4 p-6">
              <h3 className="font-sora text-sm font-semibold">Customer</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <FieldLabel htmlFor="iv-customer" required>
                    Customer name
                  </FieldLabel>
                  <Input
                    id="iv-customer"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="grid gap-1.5">
                  <FieldLabel htmlFor="iv-email" required>
                    Customer email
                  </FieldLabel>
                  <Input
                    id="iv-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="ap@acme.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-sora text-sm font-semibold">Line items</h3>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-1.5 size-3.5" />
                  Add line
                </Button>
              </div>

              <div className="border-border/60 hidden grid-cols-[minmax(0,4fr)_80px_120px_120px_40px] gap-2 border-b px-2 pb-2 text-[10px] uppercase tracking-wider text-[#8B8896] sm:grid">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit ({currency})</span>
                <span className="text-right">Amount</span>
                <span />
              </div>

              <div className="space-y-3">
                {lines.map((li, idx) => {
                  const q = Number(li.quantity) || 0
                  const p = Number(li.unitAmount) || 0
                  const amount = q * p
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,4fr)_80px_120px_120px_40px] sm:items-center"
                    >
                      <Input
                        value={li.description}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                        placeholder="Annual licence renewal"
                        className="h-9"
                      />
                      <Input
                        type="number"
                        min={1}
                        value={li.quantity}
                        onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                        className="h-9 text-right"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={li.unitAmount}
                        onChange={(e) => updateLine(idx, { unitAmount: e.target.value })}
                        placeholder="500.00"
                        className="h-9 text-right"
                      />
                      <div className="text-muted-foreground h-9 text-right font-mono text-sm leading-9">
                        {amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length <= 1}
                        aria-label="Remove line"
                        className="text-muted-foreground hover:text-rose-600 disabled:opacity-30"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-6">
              <FieldLabel htmlFor="iv-note" required={false}>
                Note
              </FieldLabel>
              <Textarea
                id="iv-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Net 14. Wire in USDC on Arc."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-24">
            <CardContent className="space-y-4 p-6">
              <h3 className="font-sora text-sm font-semibold">Details</h3>

              <div className="grid gap-1.5">
                <FieldLabel htmlFor="iv-currency" required>
                  Currency
                </FieldLabel>
                <Select value={currency} onValueChange={(v) => setCurrency(v as PaymentCurrency)}>
                  <SelectTrigger id="iv-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="EURC">EURC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <FieldLabel htmlFor="iv-due" required>
                  Due in (days)
                </FieldLabel>
                <Input
                  id="iv-due"
                  type="number"
                  min={1}
                  max={90}
                  value={dueDays}
                  onChange={(e) => setDueDays(e.target.value)}
                />
              </div>

              <div className="border-border/60 space-y-2 border-t pt-4 text-sm">
                <div className="text-muted-foreground flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {totals.subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                    {currency}
                  </span>
                </div>
                <div className="border-border/60 flex items-center justify-between border-t pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span className="font-mono">
                    {totals.subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                    {currency}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? 'Creating…' : 'Create draft'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
