'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWallets } from '@privy-io/react-auth'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Clock3, ExternalLink, Loader2, ShieldAlert, X } from 'lucide-react'
import { encodeFunctionData, isAddress } from 'viem'
import { Button, Card, CardContent, FieldLabel, Input, Label } from '@strimz/ui'

import { registryWriteAbi } from '@/lib/registry-write-abi'
import { useMerchantOnchainState } from '@/hooks/api/use-merchant'
import { merchantKeys } from '@/hooks/api/query-keys'

const ZERO = '0x0000000000000000000000000000000000000000' as const

/**
 * On-chain policy panel on the Settings page.
 *
 * Reads the live Registry record and shows:
 *   1. Payout address, with a 24-hour two-step change flow.
 *   2. Ownership, with the two-step nominate + accept flow.
 *   3. The merchant's fee ceiling and current fee.
 *
 * All writes go through the merchant's own Privy embedded wallet.
 * The API never signs registry transactions. Cache invalidates on
 * every successful tx so the pending state and timer refresh fast.
 */
export function OnchainPolicySection() {
  const { data: state, isLoading, error } = useMerchantOnchainState()

  if (isLoading) {
    return (
      <PanelShell title="On-chain policy" description="Loading current registry record...">
        <div className="text-muted-foreground text-xs">Reading from Arc...</div>
      </PanelShell>
    )
  }
  if (error) {
    return (
      <PanelShell title="On-chain policy" description="Registry read failed.">
        <div className="flex items-center gap-2 text-xs text-red-600">
          <ShieldAlert className="size-3.5" />
          Could not reach the Registry contract. Check network then retry.
        </div>
      </PanelShell>
    )
  }
  if (!state) {
    return (
      <PanelShell
        title="On-chain policy"
        description="You do not have an on-chain merchant record yet."
      >
        <div className="text-muted-foreground text-xs">
          Your merchant is registered on-chain the first time a customer creates a live-mode payment
          session. Come back here once that has happened to change the payout address or transfer
          ownership.
        </div>
      </PanelShell>
    )
  }

  return (
    <div className="space-y-4">
      <PayoutPanel state={state} />
      <OwnershipPanel state={state} />
      <FeePanel state={state} />
    </div>
  )
}

function PanelShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

// --- Payout ------------------------------------------------------------

function PayoutPanel({ state }: { state: OnchainState }) {
  const [next, setNext] = useState('')
  const tx = useRegistryTx(state)
  const nowSec = useNowSec()
  const delayDue = state.payoutChangeCommitAt !== null && nowSec >= state.payoutChangeCommitAt
  const remainingSec =
    state.payoutChangeCommitAt !== null && !delayDue ? state.payoutChangeCommitAt - nowSec : 0
  const nextValid = isAddress(next) && next.toLowerCase() !== state.payoutAddress.toLowerCase()

  return (
    <PanelShell
      title="Payout address"
      description="Where every settlement lands. Changes wait 24 hours before they go live so a stolen key does not redirect funds instantly."
    >
      <ReadonlyAddress label="Current payout" value={state.payoutAddress} />

      {state.pendingPayoutAddress ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-900">
            <Clock3 className="size-3.5" />
            {delayDue
              ? 'Pending change is ready to commit'
              : `Pending change goes live in ${formatDuration(remainingSec)}`}
          </div>
          <div className="mt-2 break-all font-mono text-[11px] text-amber-900">
            {state.pendingPayoutAddress}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!delayDue || tx.busy}
              onClick={() => tx.call('commitPayoutAddress', [BigInt(state.onchainMerchantId)])}
            >
              {tx.busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Commit change
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={tx.busy}
              onClick={() =>
                tx.call('cancelPayoutAddressChange', [BigInt(state.onchainMerchantId)])
              }
            >
              <X className="mr-1 size-3.5" />
              Cancel pending
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <FieldLabel htmlFor="new-payout" required>
            Change payout to
          </FieldLabel>
          <Input
            id="new-payout"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="0x..."
            className="h-9 font-mono"
          />
          <Button
            size="sm"
            disabled={!nextValid || tx.busy}
            onClick={() =>
              tx.call('setPayoutAddress', [BigInt(state.onchainMerchantId), next as `0x${string}`])
            }
          >
            {tx.busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            Initiate change
          </Button>
          <p className="text-muted-foreground text-xs">
            After you initiate, the current address keeps receiving payments for 24 hours. Use the
            window to reverse a mistake or cancel if a key was compromised.
          </p>
        </div>
      )}
    </PanelShell>
  )
}

// --- Ownership ---------------------------------------------------------

function OwnershipPanel({ state }: { state: OnchainState }) {
  const [nominee, setNominee] = useState('')
  const tx = useRegistryTx(state)
  const embeddedAddr = useEmbeddedWalletAddress()
  const iAmPending =
    !!state.pendingOwner &&
    !!embeddedAddr &&
    embeddedAddr.toLowerCase() === state.pendingOwner.toLowerCase()

  const validNominee = isAddress(nominee) && nominee.toLowerCase() !== state.owner.toLowerCase()

  return (
    <PanelShell
      title="Ownership"
      description="Whoever owns this record signs on-chain changes. Transfer is two-step: nominate, then the nominee accepts from their wallet."
    >
      <ReadonlyAddress label="Current owner" value={state.owner} />

      {state.pendingOwner ? (
        <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3">
          <div className="text-xs font-medium text-amber-900">
            Nominated owner (waiting to accept)
          </div>
          <div className="break-all font-mono text-[11px] text-amber-900">{state.pendingOwner}</div>
          <div className="flex flex-wrap gap-2">
            {iAmPending ? (
              <Button
                size="sm"
                disabled={tx.busy}
                onClick={() =>
                  tx.call('acceptMerchantOwnership', [BigInt(state.onchainMerchantId)])
                }
              >
                {tx.busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                Accept ownership
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={tx.busy}
              onClick={() => tx.call('cancelOwnershipTransfer', [BigInt(state.onchainMerchantId)])}
            >
              <X className="mr-1 size-3.5" />
              Cancel nomination
            </Button>
          </div>
          {!iAmPending ? (
            <p className="text-xs text-amber-900">
              The nominated wallet needs to open this dashboard from its own account and click
              Accept.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <FieldLabel htmlFor="new-owner" required>
            Nominate new owner
          </FieldLabel>
          <Input
            id="new-owner"
            value={nominee}
            onChange={(e) => setNominee(e.target.value)}
            placeholder="0x..."
            className="h-9 font-mono"
          />
          <Button
            size="sm"
            disabled={!validNominee || tx.busy}
            onClick={() =>
              tx.call('transferMerchantOwnership', [
                BigInt(state.onchainMerchantId),
                nominee as `0x${string}`,
              ])
            }
          >
            {tx.busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            Nominate
          </Button>
          <p className="text-muted-foreground text-xs">
            You keep every owner power until the nominee accepts. You can cancel at any point before
            they do.
          </p>
        </div>
      )}
    </PanelShell>
  )
}

// --- Fees --------------------------------------------------------------

function FeePanel({ state }: { state: OnchainState }) {
  return (
    <PanelShell
      title="Fees"
      description="The platform fee taken from each transaction, plus your maximum cap. Strimz cannot raise the cap. If you want a lower cap you can lower it from your wallet."
    >
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border p-3">
          <div className="text-muted-foreground text-xs">Current fee</div>
          <div className="mt-1 text-xl font-semibold">{(state.feeBps / 100).toFixed(2)}%</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-muted-foreground text-xs">Ceiling (maxFeeBps)</div>
          <div className="mt-1 text-xl font-semibold">{(state.maxFeeBps / 100).toFixed(2)}%</div>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Admin can lower the current fee any time. The ceiling can only go down, never up. Any
        attempt by admin to set a fee above the ceiling reverts on-chain.
      </p>
    </PanelShell>
  )
}

// --- Helpers -----------------------------------------------------------

function ReadonlyAddress({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2 break-all rounded-md border p-2 font-mono text-[11px]">
        {value}
      </div>
    </div>
  )
}

function useNowSec(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function useEmbeddedWalletAddress(): string | null {
  const { wallets } = useWallets()
  return useMemo(() => {
    const w = wallets.find((x) => x.walletClientType === 'privy') ?? null
    return w?.address ?? null
  }, [wallets])
}

interface OnchainState {
  onchainMerchantId: number
  registryAddress: `0x${string}`
  chainId: number
  owner: `0x${string}`
  payoutAddress: `0x${string}`
  feeBps: number
  maxFeeBps: number
  active: boolean
  pendingOwner: `0x${string}` | null
  pendingPayoutAddress: `0x${string}` | null
  payoutChangeCommitAt: number | null
  payoutChangeDelaySeconds: number
}

type WriteFn =
  | 'setPayoutAddress'
  | 'commitPayoutAddress'
  | 'cancelPayoutAddressChange'
  | 'transferMerchantOwnership'
  | 'acceptMerchantOwnership'
  | 'cancelOwnershipTransfer'

/**
 * Signs and broadcasts a registry write from the merchant's Privy
 * embedded wallet. Invalidates the on-chain-state query on success so
 * the pending fields refresh without a page reload.
 */
function useRegistryTx(state: OnchainState) {
  const { wallets } = useWallets()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const embedded = wallets.find((w) => w.walletClientType === 'privy') ?? null

  async function call(fn: WriteFn, args: readonly unknown[]) {
    if (!embedded) {
      toast.error('Connect your Privy wallet to sign.')
      return
    }
    setBusy(true)
    try {
      const data = encodeFunctionData({
        abi: registryWriteAbi,
        functionName: fn,
        // viem infers arg tuples from the ABI; the caller passes the
        // right shape.
        args: args as never,
      })
      const provider = await embedded.getEthereumProvider()
      const hash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: embedded.address as `0x${string}`,
            to: state.registryAddress,
            data,
          },
        ],
      })) as `0x${string}`
      toast.success(
        <span>
          Submitted.{' '}
          <a
            className="underline"
            href={explorerUrl(state.chainId, hash)}
            target="_blank"
            rel="noreferrer"
          >
            View on Arc <ExternalLink className="inline size-3" />
          </a>
        </span>,
      )
      // Give the RPC a beat, then refresh the on-chain read.
      setTimeout(() => qc.invalidateQueries({ queryKey: merchantKeys.onchainState() }), 4000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed'
      toast.error(message.length > 200 ? message.slice(0, 200) + '...' : message)
    } finally {
      setBusy(false)
    }
  }

  return { call, busy }
}

function explorerUrl(chainId: number, hash: string): string {
  const base = chainId === 5042002 ? 'https://testnet.arcscan.app/tx/' : 'https://arcscan.app/tx/'
  return base + hash
}

function formatDuration(sec: number): string {
  if (sec <= 0) return 'ready now'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// Suppress unused-import lint when ZERO is only used by callers.
export const ZERO_ADDRESS = ZERO
