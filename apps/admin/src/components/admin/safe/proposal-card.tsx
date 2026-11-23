'use client'

import { isAddressEqual, type Address } from 'viem'
import { toast } from 'sonner'
import { Badge, Button, Card, CardContent } from '@strimz/ui'

import type { SafeProposal, SafeProposalStatus, SafeState } from '@strimz/web-shared/lib/admin-api'
import { relativeTime } from '@strimz/web-shared/lib/format'
import {
  describeSafeCall,
  safeTxHashOf,
  type SafeKnownAddresses,
} from '@strimz/web-shared/lib/safe-console'
import {
  useExecuteSafeProposal,
  useProposeTimelockExecute,
  useSignSafeProposal,
} from '@/hooks/admin'
import type { useOwnerWallet } from '@/hooks/use-owner-wallet'

const STATUS: Record<SafeProposalStatus, { label: string; className: string }> = {
  collecting: { label: 'Needs approvals', className: 'border-warning-border text-warning' },
  ready: { label: 'Ready to run', className: 'border-accent/40 text-brand-text' },
  executing: { label: 'Sending', className: 'border-border/60' },
  executed: { label: 'Done', className: 'border-accent/40 text-brand-text' },
  failed: { label: 'Failed', className: 'border-danger/40 text-danger' },
  stale: { label: 'Out of date', className: 'border-border/60 text-muted-foreground' },
}

function read(known: SafeKnownAddresses, chainId: number, p: SafeProposal) {
  try {
    const description = describeSafeCall(known, { to: p.to, data: p.data })
    const hash = safeTxHashOf(chainId, known.safe, { to: p.to, data: p.data, nonce: p.nonce })
    if (hash !== p.safeTxHash) {
      return { description, problem: 'The server’s hash does not match this transaction.' }
    }
    return { description, problem: null }
  } catch (err) {
    return {
      description: null,
      problem: `This isn’t an action the console makes: ${(err as Error).message}`,
    }
  }
}

export function ProposalCard({
  proposal,
  state,
  known,
  chainId,
  wallet,
  explorerTx,
}: {
  proposal: SafeProposal
  state: SafeState
  known: SafeKnownAddresses
  chainId: number
  wallet: ReturnType<typeof useOwnerWallet>
  explorerTx: (hash: string) => string
}) {
  const sign = useSignSafeProposal()
  const execute = useExecuteSafeProposal()
  const runScheduled = useProposeTimelockExecute()
  const { description, problem } = read(known, chainId, proposal)
  const status = STATUS[proposal.status]
  const open = proposal.status === 'collecting' || proposal.status === 'ready'
  const signedByMe =
    wallet.address !== null &&
    proposal.signatures.some((s) => isAddressEqual(s.signer, wallet.address as Address))
  const meIsOwner =
    wallet.address !== null &&
    state.owners.some((o) => isAddressEqual(o, wallet.address as Address))
  const scheduled =
    proposal.status === 'executed' &&
    proposal.timelockOperationId !== null &&
    proposal.action.kind !== 'timelockExecute'

  async function approve() {
    try {
      const signature = await wallet.signSafeTx(chainId, known.safe, {
        to: proposal.to,
        data: proposal.data,
        nonce: proposal.nonce,
      })
      sign.mutate({ id: proposal.id, signature })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Your wallet did not sign.')
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-sora text-sm font-semibold">
              {description?.title ?? 'Unreadable proposal'}
            </h3>
            {description?.lines.map((line) => (
              <p key={line} className="text-muted-foreground break-all text-xs">
                {line}
              </p>
            ))}
          </div>
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        </div>

        {problem && (
          <p role="alert" className="text-danger text-sm">
            {problem} Don’t approve it.
          </p>
        )}

        <div className="text-muted-foreground space-y-1 text-xs">
          <p>
            Approvals: {proposal.signatures.length} of {state.threshold} · Safe nonce{' '}
            {proposal.nonce} · proposed {relativeTime(proposal.createdAt)}
          </p>
          {proposal.signatures.map((s) => (
            <p key={s.signer} className="break-all font-mono">
              ✓ {s.signer}
            </p>
          ))}
          {proposal.timelockOperationId && (
            <p className="break-all">Timelock operation {proposal.timelockOperationId}</p>
          )}
          {proposal.executeTxHash && (
            <a
              className="text-brand-text underline underline-offset-2"
              href={explorerTx(proposal.executeTxHash)}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
            </a>
          )}
          {proposal.failureReason && <p className="text-danger">{proposal.failureReason}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {open && !problem && meIsOwner && !signedByMe && (
            <Button size="sm" disabled={sign.isPending} onClick={() => void approve()}>
              {sign.isPending ? 'Waiting for your wallet…' : 'Approve with my wallet'}
            </Button>
          )}
          {proposal.status === 'ready' && !problem && (
            <Button
              size="sm"
              variant="outline"
              disabled={execute.isPending}
              onClick={() => execute.mutate(proposal.id)}
            >
              {execute.isPending ? 'Sending…' : 'Execute'}
            </Button>
          )}
          {scheduled && (
            <Button
              size="sm"
              variant="outline"
              disabled={runScheduled.isPending}
              onClick={() => runScheduled.mutate(proposal.id)}
            >
              Propose running it
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
