'use client'

import * as React from 'react'
import { Loader2, Pencil } from 'lucide-react'
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
} from '@strimz/ui'
import type { SubscriptionPlan } from '@strimz/shared-types'

import { useUpdateSubscriptionPlan } from '@/hooks/api'
import { buildReturnUrlsInput } from '@/lib/plan-input'

export function EditReturnUrlsDialog({ plan }: { plan: SubscriptionPlan }) {
  const [open, setOpen] = React.useState(false)
  const [successUrl, setSuccessUrl] = React.useState(plan.successUrl ?? '')
  const [cancelUrl, setCancelUrl] = React.useState(plan.cancelUrl ?? '')
  const [error, setError] = React.useState<string | null>(null)
  const updateMutation = useUpdateSubscriptionPlan(plan.id)

  const reset = () => {
    setSuccessUrl(plan.successUrl ?? '')
    setCancelUrl(plan.cancelUrl ?? '')
    setError(null)
  }

  const handleSave = () => {
    const built = buildReturnUrlsInput({ successUrl, cancelUrl })
    if (!built.ok) {
      setError(built.error)
      return
    }
    setError(null)
    updateMutation.mutate(built.input, { onSuccess: () => setOpen(false) })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-1.5 size-3" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Return URLs</DialogTitle>
          <DialogDescription>
            Where the full-page checkout sends subscribers. Leave a field blank to keep them on
            Strimz.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="ru-success" required={false}>
              Success URL
            </FieldLabel>
            <Input
              id="ru-success"
              type="url"
              inputMode="url"
              placeholder="https://your-app.com/welcome"
              value={successUrl}
              onChange={(e) => setSuccessUrl(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {'{SUBSCRIPTION_ID}'} and {'{ON_CHAIN_TX_HASH}'} are filled in.
            </p>
          </div>
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="ru-cancel" required={false}>
              Cancel URL
            </FieldLabel>
            <Input
              id="ru-cancel"
              type="url"
              inputMode="url"
              placeholder="https://your-app.com/pricing"
              value={cancelUrl}
              onChange={(e) => setCancelUrl(e.target.value)}
            />
          </div>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" /> Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
