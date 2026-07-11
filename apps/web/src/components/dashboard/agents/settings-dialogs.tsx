'use client'

import * as React from 'react'
import { isAddress } from 'viem'
import type { AgentMerchantConfig, UpdateAgentConfigInput } from '@strimz/shared-types'
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
  Switch,
  Textarea,
} from '@strimz/ui'

import { useUpdateAgentConfig } from '@/hooks/api'

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: AgentMerchantConfig
}

export function RecoverySettingsDialog({ open, onOpenChange, config }: DialogProps) {
  const update = useUpdateAgentConfig()
  const [grace, setGrace] = React.useState<24 | 48 | 72>(config.recovery.gracePeriodHours)
  const [strategy, setStrategy] = React.useState(config.recovery.strategy)
  const [template, setTemplate] = React.useState(config.recovery.notificationTemplate ?? '')

  React.useEffect(() => {
    if (!open) return
    setGrace(config.recovery.gracePeriodHours)
    setStrategy(config.recovery.strategy)
    setTemplate(config.recovery.notificationTemplate ?? '')
  }, [open, config.recovery])

  const submit = async () => {
    const payload: UpdateAgentConfigInput = {
      recovery: {
        gracePeriodHours: grace,
        strategy,
        notificationTemplate: template.trim() ? template.trim() : null,
      },
    }
    await update.mutateAsync(payload)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recovery settings</DialogTitle>
          <DialogDescription>
            Controls how at-risk subscription payers get nudged before a subscription is dropped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <FieldLabel required htmlFor="recovery-grace">
              Grace period
            </FieldLabel>
            <Select
              value={String(grace)}
              onValueChange={(v) => setGrace(Number(v) as 24 | 48 | 72)}
            >
              <SelectTrigger id="recovery-grace">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="48">48 hours</SelectItem>
                <SelectItem value="72">72 hours</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Wait window between the first failed charge and abandoning the subscription.
            </p>
          </div>

          <div className="space-y-2">
            <FieldLabel required htmlFor="recovery-strategy">
              Retry strategy
            </FieldLabel>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as typeof strategy)}>
              <SelectTrigger id="recovery-strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Send one reminder</SelectItem>
                <SelectItem value="twice">Send two reminders</SelectItem>
                <SelectItem value="until_grace_ends">Remind until grace ends</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <FieldLabel required={false} htmlFor="recovery-template">
              Custom email copy
            </FieldLabel>
            <Textarea
              id="recovery-template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Leave blank to use the Strimz default template."
            />
            <p className="text-muted-foreground text-xs">
              Plain text. Merchants brand + subscription name are appended automatically.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CashflowSettingsDialog({ open, onOpenChange, config }: DialogProps) {
  const update = useUpdateAgentConfig()
  const [digestEnabled, setDigestEnabled] = React.useState(config.cashflow.digestEnabled)
  const [sensitivity, setSensitivity] = React.useState(config.cashflow.anomalySensitivity)
  const [autoConvert, setAutoConvert] = React.useState(config.cashflow.autoConvertToYield)
  const [reserveUsd, setReserveUsd] = React.useState(
    (config.cashflow.minimumLiquidReserveCents / 100).toFixed(2),
  )
  const [reserveErr, setReserveErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setDigestEnabled(config.cashflow.digestEnabled)
    setSensitivity(config.cashflow.anomalySensitivity)
    setAutoConvert(config.cashflow.autoConvertToYield)
    setReserveUsd((config.cashflow.minimumLiquidReserveCents / 100).toFixed(2))
    setReserveErr(null)
  }, [open, config.cashflow])

  const submit = async () => {
    const parsed = Number(reserveUsd)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setReserveErr('Enter a non-negative amount')
      return
    }
    const cents = Math.round(parsed * 100)
    const payload: UpdateAgentConfigInput = {
      cashflow: {
        digestEnabled,
        anomalySensitivity: sensitivity,
        autoConvertToYield: autoConvert,
        minimumLiquidReserveCents: cents,
      },
    }
    await update.mutateAsync(payload)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cashflow settings</DialogTitle>
          <DialogDescription>
            Tune the daily digest, anomaly alerts, and the reserve floor before yield sweeps.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="border-border/60 flex items-start justify-between gap-3 rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Daily digest email</div>
              <p className="text-muted-foreground text-xs">
                Yesterday's gross, fees, net, unique customers. Sent 8am merchant local.
              </p>
            </div>
            <Switch checked={digestEnabled} onCheckedChange={setDigestEnabled} />
          </div>

          <div className="space-y-2">
            <FieldLabel required htmlFor="anomaly-sensitivity">
              Anomaly sensitivity
            </FieldLabel>
            <Select
              value={sensitivity}
              onValueChange={(v) => setSensitivity(v as typeof sensitivity)}
            >
              <SelectTrigger id="anomaly-sensitivity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — only large swings</SelectItem>
                <SelectItem value="medium">Medium — balanced</SelectItem>
                <SelectItem value="high">High — chatty</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Higher sensitivity means more alerts for smaller day-over-day changes.
            </p>
          </div>

          <div className="space-y-2">
            <FieldLabel required htmlFor="reserve-floor">
              Minimum liquid reserve (USD)
            </FieldLabel>
            <Input
              id="reserve-floor"
              type="number"
              min={0}
              step="0.01"
              value={reserveUsd}
              onChange={(e) => {
                setReserveUsd(e.target.value)
                setReserveErr(null)
              }}
            />
            {reserveErr ? (
              <p className="text-xs text-red-500">{reserveErr}</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Cashflow will never sweep balance below this floor into yield.
              </p>
            )}
          </div>

          <div className="border-border/60 flex items-start justify-between gap-3 rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Auto-convert surplus to yield</div>
              <p className="text-muted-foreground text-xs">
                Balance above the reserve floor gets suggested for yield. You still approve every
                sweep.
              </p>
            </div>
            <Switch checked={autoConvert} onCheckedChange={setAutoConvert} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CommerceSettingsDialog({ open, onOpenChange, config }: DialogProps) {
  const update = useUpdateAgentConfig()
  const [approvalUsd, setApprovalUsd] = React.useState(
    (config.commerce.requireHumanApprovalAboveUsdCents / 100).toFixed(2),
  )
  const [monthlyCapUsd, setMonthlyCapUsd] = React.useState(
    config.commerce.monthlySpendCapUsdCents == null
      ? ''
      : (config.commerce.monthlySpendCapUsdCents / 100).toFixed(2),
  )
  const [vendorText, setVendorText] = React.useState(config.commerce.approvedVendors.join('\n'))
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setApprovalUsd((config.commerce.requireHumanApprovalAboveUsdCents / 100).toFixed(2))
    setMonthlyCapUsd(
      config.commerce.monthlySpendCapUsdCents == null
        ? ''
        : (config.commerce.monthlySpendCapUsdCents / 100).toFixed(2),
    )
    setVendorText(config.commerce.approvedVendors.join('\n'))
    setErr(null)
  }, [open, config.commerce])

  const submit = async () => {
    const approvalNum = Number(approvalUsd)
    if (!Number.isFinite(approvalNum) || approvalNum < 0) {
      setErr('Approval threshold must be a non-negative amount')
      return
    }

    let capCents: number | null = null
    if (monthlyCapUsd.trim() !== '') {
      const capNum = Number(monthlyCapUsd)
      if (!Number.isFinite(capNum) || capNum < 0) {
        setErr('Monthly cap must be a non-negative amount or empty')
        return
      }
      capCents = Math.round(capNum * 100)
    }

    const vendors = vendorText
      .split(/[\s,]+/)
      .map((v) => v.trim())
      .filter(Boolean)
    for (const v of vendors) {
      if (!isAddress(v)) {
        setErr(`"${v}" is not a valid EVM address`)
        return
      }
    }
    const normalisedVendors = vendors.map((v) => v.toLowerCase()) as `0x${string}`[]

    const payload: UpdateAgentConfigInput = {
      commerce: {
        requireHumanApprovalAboveUsdCents: Math.round(approvalNum * 100),
        approvedVendors: normalisedVendors,
        monthlySpendCapUsdCents: capCents,
      },
    }
    await update.mutateAsync(payload)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Commerce settings</DialogTitle>
          <DialogDescription>
            Vendor allowlist, approval threshold, and monthly spend cap for escrow jobs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <FieldLabel required htmlFor="approval-threshold">
              Require your approval above (USD)
            </FieldLabel>
            <Input
              id="approval-threshold"
              type="number"
              min={0}
              step="0.01"
              value={approvalUsd}
              onChange={(e) => {
                setApprovalUsd(e.target.value)
                setErr(null)
              }}
            />
            <p className="text-muted-foreground text-xs">
              Jobs at or below this amount can escrow without a human tap.
            </p>
          </div>

          <div className="space-y-2">
            <FieldLabel required={false} htmlFor="monthly-cap">
              Monthly spend cap (USD)
            </FieldLabel>
            <Input
              id="monthly-cap"
              type="number"
              min={0}
              step="0.01"
              value={monthlyCapUsd}
              placeholder="No cap"
              onChange={(e) => {
                setMonthlyCapUsd(e.target.value)
                setErr(null)
              }}
            />
            <p className="text-muted-foreground text-xs">
              Leave blank for no cap. Once hit, further escrow jobs need a human approval.
            </p>
          </div>

          <div className="space-y-2">
            <FieldLabel required={false} htmlFor="vendor-allowlist">
              Approved vendor addresses
            </FieldLabel>
            <Textarea
              id="vendor-allowlist"
              rows={5}
              placeholder="One 0x address per line. Leave empty to disable the allowlist."
              value={vendorText}
              onChange={(e) => {
                setVendorText(e.target.value)
                setErr(null)
              }}
            />
            <p className="text-muted-foreground text-xs">
              When populated, only these vendors can receive escrow jobs.
            </p>
          </div>

          {err ? <p className="text-xs text-red-500">{err}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
