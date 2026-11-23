'use client'

import { isAddressEqual, type Address } from 'viem'
import { Badge, Button, Card, CardContent } from '@strimz/ui'
import { arcExplorerTxUrl, getArcChain, getTokenAddress } from '@strimz/shared-config'

import { PageHeader } from '@strimz/web-shared/components/dashboard/page-header'
import { env } from '@strimz/web-shared/lib/env'
import type { SafeKnownAddresses } from '@strimz/web-shared/lib/safe-console'
import { useAdminMe, useSafeProposals, useSafeState } from '@/hooks/admin'
import { useOwnerWallet } from '@/hooks/use-owner-wallet'
import { GuardianPanel } from '@/components/admin/safe/guardian-panel'
import { ProposalCard } from '@/components/admin/safe/proposal-card'
import { ProposeForm } from '@/components/admin/safe/propose-form'

const CHAIN_ID = getArcChain(env.arcEnvironment).id
const explorerTx = (hash: string) => arcExplorerTxUrl(env.arcEnvironment, hash)

export default function SafePage() {
  const me = useAdminMe()
  if (me.data && me.data.role !== 'super_admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="Safe" />
        <p className="text-muted-foreground text-sm">Only super admins can use the Safe console.</p>
      </div>
    )
  }
  return <SafeConsole />
}

function SafeConsole() {
  const stateQuery = useSafeState()
  const proposalsQuery = useSafeProposals()
  const wallet = useOwnerWallet()
  const state = stateQuery.data

  const header = (
    <PageHeader
      title="Safe"
      description="Admin actions on the Strimz contracts. Two owners approve with their own wallets; the Strimz relayer sends it and pays the fee."
    />
  )

  if (stateQuery.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <p className="text-muted-foreground text-sm">Reading the Safe…</p>
      </div>
    )
  }
  if (stateQuery.isError || !state) {
    return (
      <div className="space-y-6">
        {header}
        <p role="alert" className="text-danger text-sm">
          {stateQuery.error?.message ?? 'Could not read the Safe.'}
        </p>
        <Button variant="outline" onClick={() => void stateQuery.refetch()}>
          Try again
        </Button>
      </div>
    )
  }
  if (state.chainId !== CHAIN_ID) {
    return (
      <div className="space-y-6">
        {header}
        <p role="alert" className="text-danger text-sm">
          The server reports chain {state.chainId}, but this app is built for chain {CHAIN_ID}.
          Nothing can be approved until they match.
        </p>
      </div>
    )
  }

  const known: SafeKnownAddresses = {
    safe: state.safe,
    timelock: state.timelock,
    contracts: state.contracts,
    tokens: {
      USDC: getTokenAddress(env.arcEnvironment, 'USDC'),
      EURC: getTokenAddress(env.arcEnvironment, 'EURC'),
    },
  }
  const mine = wallet.address as Address | null
  const isOwner = mine !== null && state.owners.some((o) => isAddressEqual(o, mine))
  const isGuardian = mine !== null && isAddressEqual(state.guardian, mine)
  const proposals = proposalsQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5 text-sm">
            <h2 className="font-sora text-base font-semibold">The Safe</h2>
            <p className="break-all font-mono text-xs">{state.safe}</p>
            <p>
              {state.threshold} of {state.owners.length} owners must approve.
            </p>
            <ul className="space-y-1">
              {state.owners.map((o) => (
                <li key={o} className="flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-xs">{o}</span>
                  {mine && isAddressEqual(o, mine) && <Badge variant="outline">You</Badge>}
                  {isAddressEqual(o, state.guardian) && <Badge variant="outline">Guardian</Badge>}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              Payments {state.paused.payments ? 'paused' : 'running'}. Subscriptions{' '}
              {state.paused.subscriptions ? 'paused' : 'running'}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5 text-sm">
            <h2 className="font-sora text-base font-semibold">Your owner wallet</h2>
            {mine ? (
              <>
                <p className="break-all font-mono text-xs">{mine}</p>
                <p className={isOwner ? 'text-muted-foreground' : 'text-danger'}>
                  {isOwner
                    ? 'This wallet is a Safe owner. Approving is a signature and costs nothing.'
                    : 'This wallet is not a Safe owner. Connect the wallet that is.'}
                </p>
                <Button variant="outline" size="sm" onClick={wallet.connect}>
                  Connect a different wallet
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">
                  Connect the wallet that owns the Safe, such as MetaMask or a hardware wallet. It
                  only signs; it never needs funds to approve.
                </p>
                <Button size="sm" disabled={!wallet.ready} onClick={wallet.connect}>
                  Connect wallet
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {isGuardian && (
        <GuardianPanel state={state} chainId={CHAIN_ID} wallet={wallet} explorerTx={explorerTx} />
      )}

      <ProposeForm state={state} />

      <section className="space-y-3">
        <h2 className="font-sora text-base font-semibold">Proposals</h2>
        {proposalsQuery.isError && (
          <p role="alert" className="text-danger text-sm">
            {proposalsQuery.error.message}
          </p>
        )}
        {proposalsQuery.isPending && (
          <p className="text-muted-foreground text-sm">Loading proposals…</p>
        )}
        {proposalsQuery.isSuccess && proposals.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Nothing proposed yet. Use the form above to start one.
          </p>
        )}
        {proposals.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            state={state}
            known={known}
            chainId={CHAIN_ID}
            wallet={wallet}
            explorerTx={explorerTx}
          />
        ))}
      </section>
    </div>
  )
}
