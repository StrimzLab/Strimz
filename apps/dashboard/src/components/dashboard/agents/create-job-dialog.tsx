'use client'

import * as React from 'react'
import { isAddress } from 'viem'
import type { CreateAgentJobInput } from '@strimz/shared-types'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@strimz/ui'

import { useCreateAgentJob } from '@/hooks/api'

const DECIMALS: Record<'USDC' | 'EURC', number> = { USDC: 6, EURC: 6 }

function toBaseUnits(input: string, decimals: number): bigint {
  const trimmed = input.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error('Enter a numeric amount')
  const [whole, frac = ''] = trimmed.split('.')
  if (frac.length > decimals) {
    throw new Error(`At most ${decimals} decimal places allowed`)
  }
  const padded = frac.padEnd(decimals, '0')
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(padded || '0')
}

export function CreateAgentJobDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateAgentJob()
  const [vendor, setVendor] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [amountUi, setAmountUi] = React.useState('')
  const [currency, setCurrency] = React.useState<'USDC' | 'EURC'>('USDC')
  const [assessor, setAssessor] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) return
    setVendor('')
    setDescription('')
    setAmountUi('')
    setCurrency('USDC')
    setAssessor('')
    setErr(null)
  }, [open])

  const submit = async () => {
    setErr(null)
    if (!isAddress(vendor.trim())) {
      setErr('Vendor must be a valid EVM address')
      return
    }
    if (!description.trim()) {
      setErr('Description is required')
      return
    }
    if (assessor.trim() && !isAddress(assessor.trim())) {
      setErr('Assessor must be a valid EVM address or blank')
      return
    }
    let baseUnits: bigint
    try {
      baseUnits = toBaseUnits(amountUi, DECIMALS[currency])
    } catch (e) {
      setErr((e as Error).message)
      return
    }
    if (baseUnits <= 0n) {
      setErr('Amount must be greater than zero')
      return
    }

    const payload: CreateAgentJobInput = {
      vendorAddress: vendor.trim().toLowerCase() as `0x${string}`,
      description: description.trim(),
      amount: baseUnits.toString(),
      currency,
      ...(assessor.trim()
        ? { assessorAddress: assessor.trim().toLowerCase() as `0x${string}` }
        : {}),
    }
    await create.mutateAsync(payload)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New agent job</DialogTitle>
          <DialogDescription>
            Propose an escrow job. Your Commerce agent creates it on-chain and it lands here for
            your final approval before release.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <FieldLabel required htmlFor="job-vendor">
              Vendor address
            </FieldLabel>
            <Input
              id="job-vendor"
              placeholder="0x…"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel required htmlFor="job-desc">
              Description
            </FieldLabel>
            <Textarea
              id="job-desc"
              rows={3}
              maxLength={2000}
              placeholder="What's this job for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <FieldLabel required htmlFor="job-amount">
                Amount
              </FieldLabel>
              <Input
                id="job-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountUi}
                onChange={(e) => setAmountUi(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel required htmlFor="job-currency">
                Currency
              </FieldLabel>
              <Select value={currency} onValueChange={(v) => setCurrency(v as 'USDC' | 'EURC')}>
                <SelectTrigger id="job-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="EURC">EURC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel required={false} htmlFor="job-assessor">
              Assessor address
            </FieldLabel>
            <Input
              id="job-assessor"
              placeholder="0x… (defaults to your address)"
              value={assessor}
              onChange={(e) => setAssessor(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-muted-foreground text-xs">
              Third party who signs off delivery. Leave blank to be your own assessor.
            </p>
          </div>

          {err ? <p className="text-xs text-red-500">{err}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
