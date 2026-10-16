'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
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
import type { PaymentCurrency, SubscriptionInterval } from '@strimz/shared-types'

import { useCreateSubscriptionPlan } from '@/hooks/api'
import { buildPlanInput } from '@/lib/plan-input'

const INTERVALS: ReadonlyArray<[SubscriptionInterval, string]> = [
  ['daily', 'Daily'],
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
  ['quarterly', 'Quarterly'],
  ['yearly', 'Yearly'],
]

const EMPTY = { name: '', description: '', amount: '', intervalCount: '', trialDays: '' }

export function NewPlanDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [fields, setFields] = React.useState(EMPTY)
  const [currency, setCurrency] = React.useState<PaymentCurrency>('USDC')
  const [interval, setInterval] = React.useState<SubscriptionInterval>('monthly')
  const [error, setError] = React.useState<string | null>(null)
  const createMutation = useCreateSubscriptionPlan()

  const set =
    (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((prev) => ({ ...prev, [key]: e.target.value }))

  const reset = () => {
    setFields(EMPTY)
    setCurrency('USDC')
    setInterval('monthly')
    setError(null)
  }

  const handleCreate = () => {
    const built = buildPlanInput({ ...fields, currency, interval })
    if (!built.ok) {
      setError(built.error)
      return
    }
    setError(null)
    createMutation.mutate(built.input, {
      onSuccess: (plan) => {
        setOpen(false)
        reset()
        router.push(`/app/plans/${plan.id}`)
      },
    })
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
          <Plus className="mr-1.5 size-4" /> New plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New subscription plan</DialogTitle>
          <DialogDescription>
            Plans cannot be edited after creation. To change the price, create a new plan and
            archive the old one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="pl-name" required>
              Plan name
            </FieldLabel>
            <Input id="pl-name" placeholder="Pro" value={fields.name} onChange={set('name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="pl-amount" required>
                Price
              </FieldLabel>
              <Input
                id="pl-amount"
                inputMode="decimal"
                placeholder="29.00"
                value={fields.amount}
                onChange={set('amount')}
              />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="pl-currency" required>
                Currency
              </FieldLabel>
              <Select value={currency} onValueChange={(v) => setCurrency(v as PaymentCurrency)}>
                <SelectTrigger id="pl-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="EURC">EURC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="pl-interval" required>
                Interval
              </FieldLabel>
              <Select
                value={interval}
                onValueChange={(v) => setInterval(v as SubscriptionInterval)}
              >
                <SelectTrigger id="pl-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVALS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="pl-count" required={false}>
                Bill every
              </FieldLabel>
              <Input
                id="pl-count"
                inputMode="numeric"
                placeholder="1"
                value={fields.intervalCount}
                onChange={set('intervalCount')}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="pl-trial" required={false}>
              Free trial (days)
            </FieldLabel>
            <Input
              id="pl-trial"
              inputMode="numeric"
              placeholder="0"
              value={fields.trialDays}
              onChange={set('trialDays')}
            />
          </div>
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="pl-description" required={false}>
              Description
            </FieldLabel>
            <Textarea
              id="pl-description"
              rows={2}
              placeholder="What subscribers get"
              value={fields.description}
              onChange={set('description')}
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
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || !fields.name || !fields.amount}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" /> Creating…
              </>
            ) : (
              'Create plan'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
