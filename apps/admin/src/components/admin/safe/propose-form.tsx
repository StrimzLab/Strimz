'use client'

import * as React from 'react'
import { isAddress, parseUnits } from 'viem'
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
} from '@strimz/ui'

import type {
  SafeAction,
  SafeContract,
  SafeRole,
  SafeState,
} from '@strimz/web-shared/lib/admin-api'
import { ROLE_NAMES } from '@strimz/web-shared/lib/safe-console'
import { useProposeSafeAction } from '@/hooks/admin'

type Kind =
  | 'pause'
  | 'unpause'
  | 'withdrawFees'
  | 'grantRole'
  | 'revokeRole'
  | 'timelockCancel'
  | 'addOwner'
  | 'removeOwner'
  | 'swapOwner'
  | 'changeThreshold'

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'pause', label: 'Pause a contract' },
  { kind: 'unpause', label: 'Unpause a contract' },
  { kind: 'withdrawFees', label: 'Withdraw fees' },
  { kind: 'grantRole', label: 'Grant a role' },
  { kind: 'revokeRole', label: 'Revoke a role' },
  { kind: 'timelockCancel', label: 'Cancel a scheduled change' },
  { kind: 'addOwner', label: 'Add a Safe owner' },
  { kind: 'removeOwner', label: 'Remove a Safe owner' },
  { kind: 'swapOwner', label: 'Replace a Safe owner' },
  { kind: 'changeThreshold', label: 'Change the approvals needed' },
]

const CONTRACTS: { value: SafeContract; label: string }[] = [
  { value: 'registry', label: 'Registry' },
  { value: 'payments', label: 'Payments' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'feeCollector', label: 'Fee collector' },
  { value: 'tokenWhitelist', label: 'Token whitelist' },
]

interface Fields {
  contract: string
  role: string
  account: string
  token: string
  amount: string
  operationId: string
  owner: string
  newOwner: string
  threshold: string
}

const EMPTY: Fields = {
  contract: '',
  role: '',
  account: '',
  token: 'USDC',
  amount: '',
  operationId: '',
  owner: '',
  newOwner: '',
  threshold: '',
}

function toAction(kind: Kind, f: Fields): SafeAction | string {
  const address = (v: string, what: string) => (isAddress(v) ? null : `Enter a valid ${what}.`)
  const threshold = Number(f.threshold)
  const badThreshold =
    !Number.isInteger(threshold) || threshold < 2 ? 'Approvals needed must be 2 or more.' : null
  switch (kind) {
    case 'pause':
    case 'unpause':
      if (f.contract !== 'payments' && f.contract !== 'subscriptions') {
        return 'Choose Payments or Subscriptions.'
      }
      return { kind, contract: f.contract }
    case 'withdrawFees': {
      const err = address(f.account, 'recipient address')
      if (err) return err
      let base: bigint
      try {
        base = parseUnits(f.amount, 6)
      } catch {
        return 'Enter the amount as a number, like 12.50.'
      }
      if (base <= 0n) return 'The amount must be more than 0.'
      return {
        kind,
        token: f.token === 'EURC' ? 'EURC' : 'USDC',
        to: f.account,
        amount: base.toString(),
      }
    }
    case 'grantRole':
    case 'revokeRole': {
      if (!f.contract) return 'Choose a contract.'
      if (!f.role) return 'Choose a role.'
      const err = address(f.account, 'account address')
      if (err) return err
      return {
        kind,
        contract: f.contract as SafeContract,
        role: f.role as SafeRole,
        account: f.account,
      }
    }
    case 'timelockCancel':
      if (!/^0x[0-9a-fA-F]{64}$/u.test(f.operationId)) return 'Enter the 66-character operation ID.'
      return { kind, operationId: f.operationId }
    case 'addOwner':
    case 'removeOwner':
      return (
        address(f.owner, 'owner address') ?? badThreshold ?? { kind, owner: f.owner, threshold }
      )
    case 'swapOwner':
      return (
        address(f.owner, 'current owner') ??
        address(f.newOwner, 'new owner address') ?? {
          kind,
          oldOwner: f.owner,
          newOwner: f.newOwner,
        }
      )
    case 'changeThreshold':
      return badThreshold ?? { kind, threshold }
  }
}

export function ProposeForm({ state }: { state: SafeState }) {
  const [kind, setKind] = React.useState<Kind | ''>('')
  const [fields, setFields] = React.useState<Fields>(EMPTY)
  const [error, setError] = React.useState<string | null>(null)
  const propose = useProposeSafeAction()
  const set = (key: keyof Fields) => (value: string) => setFields((f) => ({ ...f, [key]: value }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!kind) return setError('Choose an action.')
    const action = toAction(kind, fields)
    if (typeof action === 'string') return setError(action)
    setError(null)
    propose.mutate(action, {
      onSuccess: () => {
        setKind('')
        setFields(EMPTY)
      },
    })
  }

  const ownerSelect = (id: string, label: string) => (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id} required>
        {label}
      </FieldLabel>
      <Select value={fields.owner} onValueChange={set('owner')}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Choose an owner" />
        </SelectTrigger>
        <SelectContent>
          {state.owners.map((o) => (
            <SelectItem key={o} value={o}>
              <span className="font-mono text-xs">{o}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const textField = (key: keyof Fields, id: string, label: string, placeholder: string) => (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id} required>
        {label}
      </FieldLabel>
      <Input
        id={id}
        value={fields[key]}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => set(key)(e.target.value.trim())}
      />
    </div>
  )

  const thresholdField = textField('threshold', 'safe-threshold', 'Approvals needed', '2')
  const pausable = kind === 'pause' || kind === 'unpause'
  const roles = kind === 'grantRole' || kind === 'revokeRole'

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="font-sora text-base font-semibold">Propose an action</h2>
          <p className="text-muted-foreground text-sm">
            Pick from the list. It then needs {state.threshold} owners to approve before anyone can
            run it.
          </p>
        </div>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="safe-action" required>
              Action
            </FieldLabel>
            <Select
              value={kind}
              onValueChange={(v) => {
                setKind(v as Kind)
                setFields(EMPTY)
                setError(null)
              }}
            >
              <SelectTrigger id="safe-action">
                <SelectValue placeholder="Choose an action" />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.kind} value={k.kind}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(pausable || roles) && (
            <div className="space-y-1.5">
              <FieldLabel htmlFor="safe-contract" required>
                Contract
              </FieldLabel>
              <Select value={fields.contract} onValueChange={set('contract')}>
                <SelectTrigger id="safe-contract">
                  <SelectValue placeholder="Choose a contract" />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACTS.filter(
                    (c) => !pausable || c.value === 'payments' || c.value === 'subscriptions',
                  ).map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {roles && (
            <>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="safe-role" required>
                  Role
                </FieldLabel>
                <Select value={fields.role} onValueChange={set('role')}>
                  <SelectTrigger id="safe-role">
                    <SelectValue placeholder="Choose a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_NAMES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {textField('account', 'safe-account', 'Account', '0x…')}
              <p className="text-muted-foreground text-xs">
                The relayer and scheduler roles change at once. Every other role is scheduled and
                runs after {state.timelockDelaySeconds / 3600} hours.
              </p>
            </>
          )}

          {kind === 'withdrawFees' && (
            <>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="safe-token" required>
                  Token
                </FieldLabel>
                <Select value={fields.token} onValueChange={set('token')}>
                  <SelectTrigger id="safe-token">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="EURC">EURC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {textField('amount', 'safe-amount', 'Amount', '0.00')}
              {textField('account', 'safe-recipient', 'Send to', '0x…')}
            </>
          )}

          {kind === 'timelockCancel' &&
            textField('operationId', 'safe-operation', 'Operation ID', '0x…')}

          {kind === 'addOwner' && (
            <>
              {textField('owner', 'safe-new-owner', 'New owner', '0x…')}
              {thresholdField}
            </>
          )}
          {kind === 'removeOwner' && (
            <>
              {ownerSelect('safe-remove-owner', 'Owner to remove')}
              {thresholdField}
            </>
          )}
          {kind === 'swapOwner' && (
            <>
              {ownerSelect('safe-old-owner', 'Owner to replace')}
              {textField('newOwner', 'safe-replacement', 'New owner', '0x…')}
            </>
          )}
          {kind === 'changeThreshold' && thresholdField}

          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={!kind || propose.isPending}>
            {propose.isPending ? 'Proposing…' : 'Propose'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
