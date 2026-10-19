'use client'

import * as React from 'react'
import Link from 'next/link'
import { Copy, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@strimz/ui'
import type { PaymentCurrency, PaymentSession } from '@strimz/shared-types'

import { useCreatePaymentSession } from '@/hooks/api'
import { formatTokenAmount } from '@/lib/format'
import { buildPaymentSessionInput } from '@/lib/payment-session-input'
import { OpenOnNewParam } from '@/components/dashboard/open-on-new-param'

const EMPTY = {
  amount: '',
  description: '',
  customerEmail: '',
  expiresInMinutes: '',
  successUrl: '',
  cancelUrl: '',
}

export function NewPaymentSessionDialog() {
  const [open, setOpen] = React.useState(false)
  const openFromLink = React.useCallback(() => setOpen(true), [])
  const [fields, setFields] = React.useState(EMPTY)
  const [currency, setCurrency] = React.useState<PaymentCurrency>('USDC')
  const [error, setError] = React.useState<string | null>(null)
  const [created, setCreated] = React.useState<PaymentSession | null>(null)
  const createMutation = useCreatePaymentSession()

  const set =
    (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((prev) => ({ ...prev, [key]: e.target.value }))

  const reset = () => {
    setFields(EMPTY)
    setCurrency('USDC')
    setError(null)
    setCreated(null)
  }

  const handleCreate = () => {
    const built = buildPaymentSessionInput({ ...fields, currency })
    if (!built.ok) {
      setError(built.error)
      return
    }
    setError(null)
    createMutation.mutate(built.input, { onSuccess: setCreated })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" /> New payment link
        </Button>
      </DialogTrigger>
      <OpenOnNewParam onOpen={openFromLink} />
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Payment link ready</DialogTitle>
              <DialogDescription>
                Send this link to your customer. It accepts{' '}
                {formatTokenAmount(created.amount, created.currency)} until it expires.
              </DialogDescription>
            </DialogHeader>
            <div className="border-border/60 bg-muted/30 flex items-center gap-2 rounded-md border p-2">
              <code className="min-w-0 flex-1 truncate text-xs">{created.checkoutUrl}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(created.checkoutUrl)
                    .then(() => toast.success('Payment link copied'))
                }}
              >
                <Copy className="mr-1.5 size-3" /> Copy
              </Button>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Done
              </Button>
              <Button asChild>
                <Link href={`/app/payment-sessions/${created.id}`}>Open session</Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New payment link</DialogTitle>
              <DialogDescription>
                Creates a hosted checkout link for one payment. Your customer pays with USDC or EURC
                on Arc.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <FieldLabel htmlFor="ps-amount" required>
                    Amount
                  </FieldLabel>
                  <Input
                    id="ps-amount"
                    inputMode="decimal"
                    placeholder="25.00"
                    value={fields.amount}
                    onChange={set('amount')}
                  />
                </div>
                <div className="grid gap-1.5">
                  <FieldLabel htmlFor="ps-currency" required>
                    Currency
                  </FieldLabel>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as PaymentCurrency)}>
                    <SelectTrigger id="ps-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="EURC">EURC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel htmlFor="ps-description" required={false}>
                  Description
                </FieldLabel>
                <Textarea
                  id="ps-description"
                  rows={2}
                  placeholder="What the customer is paying for"
                  value={fields.description}
                  onChange={set('description')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <FieldLabel htmlFor="ps-email" required={false}>
                    Customer email
                  </FieldLabel>
                  <Input
                    id="ps-email"
                    type="email"
                    placeholder="buyer@example.com"
                    value={fields.customerEmail}
                    onChange={set('customerEmail')}
                  />
                </div>
                <div className="grid gap-1.5">
                  <FieldLabel htmlFor="ps-expiry" required={false}>
                    Expires in (minutes)
                  </FieldLabel>
                  <Input
                    id="ps-expiry"
                    inputMode="numeric"
                    placeholder="30"
                    value={fields.expiresInMinutes}
                    onChange={set('expiresInMinutes')}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel htmlFor="ps-success" required={false}>
                  Success URL
                </FieldLabel>
                <Input
                  id="ps-success"
                  placeholder="https://your-site.com/thanks"
                  value={fields.successUrl}
                  onChange={set('successUrl')}
                />
              </div>
              <div className="grid gap-1.5">
                <FieldLabel htmlFor="ps-cancel" required={false}>
                  Cancel URL
                </FieldLabel>
                <Input
                  id="ps-cancel"
                  placeholder="https://your-site.com/cart"
                  value={fields.cancelUrl}
                  onChange={set('cancelUrl')}
                />
              </div>
              {error ? <p className="text-xs text-rose-600">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !fields.amount}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" /> Creating…
                  </>
                ) : (
                  'Create link'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
