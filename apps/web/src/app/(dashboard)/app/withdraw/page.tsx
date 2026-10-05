'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useWallets } from '@privy-io/react-auth'
import { toast } from 'sonner'
import {
  ArrowUpFromLine,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  ShieldAlert,
  Wallet as WalletIcon,
} from 'lucide-react'
import {
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  toHex,
} from 'viem'
import { arcTestnet } from '@strimz/shared-config'
import { Badge, Button, Card, CardContent, FieldLabel, Input, Label } from '@strimz/ui'
import type { MerchantBalanceView } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { TokenLogo } from '@/components/shared/token-logo'
import { useMerchantBalance } from '@/hooks/api/use-merchant'
import { useWithdrawGasQuote } from '@/hooks/use-withdraw-gas-quote'
import { env } from '@/lib/env'
import { formatTokenAmount } from '@/lib/format'
import { checkWithdrawAmount, maxWithdrawable, type WithdrawCheck } from '@/lib/withdraw-gas'

const EXPLORER_BY_ENV = {
  testnet: 'https://testnet.arcscan.app/tx/',
  mainnet: 'https://arcscan.app/tx/',
} as const

/**
 * Withdraw page.
 *
 * The Strimz architecture is non-custodial: on-chain payments settle
 * directly into `merchant.payoutAddress`. So "withdrawal" is really
 * "the merchant moving their USDC out of that address." Two flows
 * depending on whether the merchant can sign from the dashboard:
 *
 *   - `canSignFromDashboard === true` (payoutAddress matches the
 *     Privy embedded wallet). The dashboard offers an on-chain
 *     transfer signed with Privy directly. No wallet-connect ceremony.
 *   - `canSignFromDashboard === false` (payoutAddress is a treasury,
 *     multisig, hardware wallet, etc.). The dashboard shows the
 *     address + a copy button so the merchant can move funds with
 *     whichever tool they already use.
 *
 * We ONLY support USDC + EURC. The two currencies Strimz sessions
 * settle in. Gas is paid in USDC on Arc automatically; the merchant
 * doesn't need any ETH.
 */
export default function WithdrawPage() {
  const balanceQuery = useMerchantBalance()
  const { wallets } = useWallets()

  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'USDC' | 'EURC'>('USDC')
  const [submitting, setSubmitting] = useState(false)
  const [lastTx, setLastTx] = useState<string | null>(null)

  const balance = balanceQuery.data
  const selectedBalance = balance?.balances.find((b) => b.currency === currency)
  const chain = arcTestnet
  const explorerBase = EXPLORER_BY_ENV[env.arcEnvironment]

  const embeddedWallet = useMemo(() => {
    // The dashboard uses Privy's embedded wallet as the payout wallet
    // by default. Find it explicitly instead of grabbing wallets[0]
    // (which could be a linked external wallet on multi-wallet Privy).
    return wallets.find((w) => w.walletClientType === 'privy') ?? null
  }, [wallets])

  const destinationOk = destination.trim() !== '' && isAddress(destination.trim())
  const destinationAddress = destinationOk ? getAddress(destination.trim()) : null
  const usdcBalance = BigInt(balance?.balances.find((b) => b.currency === 'USDC')?.raw ?? '0')
  const signingWallet = balance?.canSignFromDashboard ? embeddedWallet : null

  const gasQuery = useWithdrawGasQuote({
    wallet: signingWallet,
    chainId: chain.id,
    token:
      selectedBalance && isAddress(selectedBalance.contractAddress)
        ? selectedBalance.contractAddress
        : undefined,
    destination: destinationAddress,
  })
  const gasReserve = gasQuery.data?.reserve ?? null

  const wanted = useMemo(() => {
    if (!amount || !selectedBalance) return null
    try {
      return parseUnits(amount, selectedBalance.decimals)
    } catch {
      return null
    }
  }, [amount, selectedBalance])

  const amountCheck: WithdrawCheck | null =
    wanted === null
      ? amount
        ? { ok: false, reason: 'exceeds_balance' }
        : null
      : selectedBalance && gasReserve !== null
        ? checkWithdrawAmount({
            currency,
            amount: wanted,
            balance: BigInt(selectedBalance.raw),
            usdcBalance,
            reserve: gasReserve,
          })
        : null
  const amountOk = amountCheck?.ok === true

  function fillMax() {
    if (!selectedBalance || gasReserve === null) return
    const max = maxWithdrawable({
      currency,
      balance: BigInt(selectedBalance.raw),
      usdcBalance,
      reserve: gasReserve,
    })
    setAmount(formatUnits(max, selectedBalance.decimals))
  }

  const canSubmit =
    balance?.canSignFromDashboard &&
    Boolean(embeddedWallet) &&
    destinationOk &&
    amountOk &&
    !submitting

  async function copyAddress(value: string) {
    await navigator.clipboard.writeText(value)
    toast.success('Address copied')
  }

  async function handleWithdraw(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit || !embeddedWallet || !selectedBalance || !destinationAddress || wanted === null)
      return
    setSubmitting(true)
    setLastTx(null)
    try {
      // Make sure the wallet is on the right chain before signing.
      // Privy handles the switch prompt if needed.
      await embeddedWallet.switchChain(chain.id)

      const fresh = await gasQuery.refetch()
      if (!fresh.data) {
        throw new Error(
          `Couldn't estimate the network fee: ${fresh.error?.message ?? 'no estimate returned'}`,
        )
      }
      const freshCheck = checkWithdrawAmount({
        currency,
        amount: wanted,
        balance: BigInt(selectedBalance.raw),
        usdcBalance,
        reserve: fresh.data.reserve,
      })
      if (!freshCheck.ok) {
        throw new Error(
          withdrawProblem(freshCheck.reason, currency, fresh.data.reserve, usdcBalance),
        )
      }

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [destinationAddress, wanted],
      })

      const provider = await embeddedWallet.getEthereumProvider()
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: embeddedWallet.address as `0x${string}`,
            to: selectedBalance.contractAddress,
            data,
            value: '0x0',
            gas: toHex(fresh.data.quote.gas),
            maxFeePerGas: toHex(fresh.data.quote.maxFeePerGas),
            maxPriorityFeePerGas: toHex(fresh.data.quote.maxPriorityFeePerGas),
          },
        ],
      })

      setLastTx(hash as string)
      toast.success('Transfer signed. Waiting for confirmation…')
      // Refetch balance after ~13s (Arc block time) so the UI reflects
      // the new balance without waiting for the poll interval.
      setTimeout(() => balanceQuery.refetch(), 14_000)
    } catch (err) {
      const message = (err as Error).message?.split('\n')[0] ?? 'Failed to send transaction'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdraw"
        docsSlug="withdraw"
        description="Move your USDC or EURC out of your Strimz payout address."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {balanceQuery.isPending ? (
            <BalanceSkeleton />
          ) : balanceQuery.isError ? (
            <Card className="border-border/60">
              <CardContent className="p-6 text-sm text-rose-600">
                Couldn&apos;t load your on-chain balance. Check your RPC connection and try again.
              </CardContent>
            </Card>
          ) : balance && balance.payoutAddress ? (
            <BalanceCard balance={balance} onCopy={copyAddress} />
          ) : (
            <Card className="border-border/60 border-dashed">
              <CardContent className="text-muted-foreground p-6 text-sm">
                Set a payout address on the{' '}
                <Link href="/app/settings" className="text-accent underline">
                  Settings page
                </Link>{' '}
                before you can withdraw.
              </CardContent>
            </Card>
          )}

          {balance && balance.payoutAddress && (
            <Card className="border-border/60">
              <CardContent className="p-6">
                <h3 className="font-sora inline-flex items-center gap-2 text-base font-[600]">
                  <ArrowUpFromLine className="text-accent size-4" />
                  Send funds
                </h3>
                {balance.canSignFromDashboard ? (
                  <p className="font-poppins text-muted-foreground mt-1 text-xs">
                    You&apos;re paying yourself. Sign the transfer with your Strimz-embedded wallet.
                    No external wallet needed.
                  </p>
                ) : (
                  <div className="border-border/60 bg-muted text-muted-foreground mt-4 flex items-start gap-2 rounded-md border p-3 text-xs">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-foreground font-medium">
                        Your payout goes to an external wallet.
                      </p>
                      <p className="mt-1">
                        You can&apos;t send from this dashboard. Sign in with the wallet that
                        controls{' '}
                        <code className="text-foreground">
                          {balance.payoutAddress.slice(0, 6)}…{balance.payoutAddress.slice(-4)}
                        </code>{' '}
                        and transfer from there. Or point your payout to a different address on the
                        Settings page.
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleWithdraw} className="mt-5 space-y-4">
                  <div>
                    <Label className="font-poppins mb-2 block text-sm">Currency</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {balance.balances.map((b) => (
                        <button
                          key={b.currency}
                          type="button"
                          onClick={() => setCurrency(b.currency)}
                          className={`border-border/60 flex items-center gap-2 rounded-md border p-3 text-left transition-colors ${
                            currency === b.currency ? 'border-accent/60 bg-accent/5' : ''
                          }`}
                        >
                          <TokenLogo symbol={b.currency} size={20} />
                          <div className="flex-1">
                            <div className="font-poppins text-sm font-medium">{b.currency}</div>
                            <div className="font-poppins text-muted-foreground text-[10px]">
                              Available {b.formatted}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <FieldLabel
                      htmlFor="destination"
                      className="font-poppins mb-2 block text-sm"
                      required
                    >
                      Send to
                    </FieldLabel>
                    <Input
                      id="destination"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="0x…"
                      spellCheck={false}
                      autoComplete="off"
                    />
                    {destination && !destinationOk && (
                      <p className="font-poppins mt-1 text-xs text-rose-600">
                        Enter a valid 0x address.
                      </p>
                    )}
                  </div>

                  <div>
                    <FieldLabel
                      htmlFor="amount"
                      className="font-poppins mb-2 block text-sm"
                      required
                    >
                      Amount ({currency})
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        id="amount"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                      />
                      {selectedBalance && (
                        <button
                          type="button"
                          onClick={fillMax}
                          disabled={gasReserve === null}
                          title={
                            gasReserve === null
                              ? 'Enter a destination so the network fee can be estimated'
                              : undefined
                          }
                          className="bg-accent/10 text-accent absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          MAX
                        </button>
                      )}
                    </div>
                    {selectedBalance && (
                      <p className="font-poppins text-muted-foreground mt-1 text-[10px]">
                        Balance: {selectedBalance.formatted} {selectedBalance.currency}
                      </p>
                    )}
                    {balance.canSignFromDashboard && (
                      <NetworkFeeNote
                        destinationOk={destinationOk}
                        loading={gasQuery.isFetching && gasReserve === null}
                        error={gasQuery.isError ? gasQuery.error.message : null}
                        reserve={gasReserve}
                        currency={currency}
                        usdcBalance={usdcBalance}
                      />
                    )}
                    {amountCheck && !amountCheck.ok && (
                      <p className="font-poppins mt-1 text-xs text-rose-600">
                        {withdrawProblem(amountCheck.reason, currency, gasReserve, usdcBalance)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
                      <Info className="size-3" />
                      Settles in ~13s on {chain.name}
                    </div>
                    <Button type="submit" disabled={!canSubmit}>
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <ArrowUpFromLine className="mr-2 size-4" />
                          Withdraw
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                {lastTx && (
                  <div className="border-border/60 bg-accent/5 mt-5 rounded-md border p-3 text-xs">
                    <p className="font-poppins text-foreground font-medium">Transfer signed</p>
                    <a
                      href={`${explorerBase}${lastTx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-poppins text-accent mt-1 inline-flex items-center gap-1 break-all hover:underline"
                    >
                      {lastTx}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <WalletIcon className="text-muted-foreground size-4" />
                <h3 className="font-poppins text-sm font-medium">Non-custodial</h3>
              </div>
              <p className="font-poppins text-muted-foreground mt-2 text-xs leading-5">
                Strimz never holds your funds. On-chain payments settle straight into your payout
                wallet. When you withdraw here, you&apos;re moving YOUR funds. Not requesting a
                payout from us.
              </p>
              <div className="border-border/60 mt-3 border-t pt-3">
                <p className="font-poppins text-muted-foreground text-[10px] uppercase tracking-wider">
                  Settlement chain
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="bg-accent size-1.5 rounded-full" />
                  <span className="font-poppins text-sm">{chain.name}</span>
                  <Badge variant="outline" className="ml-auto text-[10px] capitalize">
                    {env.arcEnvironment}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function withdrawProblem(
  reason: Exclude<WithdrawCheck, { ok: true }>['reason'],
  currency: 'USDC' | 'EURC',
  reserve: bigint | null,
  usdcBalance: bigint,
): string {
  if (reason === 'not_positive') return 'Enter an amount above zero.'
  if (reason === 'exceeds_balance') return 'Enter an amount within your available balance.'
  const fee = reserve === null ? 'the network fee' : formatTokenAmount(reserve.toString(), 'USDC')
  if (currency === 'USDC') {
    return `Leave up to ${fee} in USDC for the network fee. MAX does this for you.`
  }
  return `Gas on Arc is paid in USDC. You need up to ${fee} for this transfer and have ${formatTokenAmount(usdcBalance.toString(), 'USDC')}. Add USDC to this wallet first.`
}

function NetworkFeeNote({
  destinationOk,
  loading,
  error,
  reserve,
  currency,
  usdcBalance,
}: {
  destinationOk: boolean
  loading: boolean
  error: string | null
  reserve: bigint | null
  currency: 'USDC' | 'EURC'
  usdcBalance: bigint
}) {
  if (error) {
    return (
      <p className="font-poppins mt-1 text-xs text-rose-600">
        Couldn&apos;t estimate the network fee: {error}
      </p>
    )
  }
  if (!destinationOk) {
    return (
      <p className="font-poppins text-muted-foreground mt-1 text-[10px]">
        Enter a destination to estimate the network fee.
      </p>
    )
  }
  if (loading || reserve === null) {
    return (
      <p className="font-poppins text-muted-foreground mt-1 text-[10px]">
        Estimating the network fee…
      </p>
    )
  }
  const fee = formatTokenAmount(reserve.toString(), 'USDC')
  return (
    <p className="font-poppins text-muted-foreground mt-1 text-[10px]">
      {currency === 'USDC'
        ? `Up to ${fee} is held back for the network fee, which Arc charges in USDC.`
        : `Arc charges the network fee in USDC: up to ${fee} comes from your USDC balance (${formatTokenAmount(usdcBalance.toString(), 'USDC')}).`}
    </p>
  )
}

function BalanceSkeleton() {
  return (
    <Card className="border-border/60">
      <CardContent className="p-6">
        <div className="bg-muted/40 h-4 w-24 animate-pulse rounded" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="bg-muted/40 h-24 animate-pulse rounded" />
          <div className="bg-muted/40 h-24 animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  )
}

function BalanceCard({
  balance,
  onCopy,
}: {
  balance: MerchantBalanceView
  onCopy: (v: string) => void
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-poppins text-muted-foreground text-[10px] uppercase tracking-wider">
              Payout address
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="text-foreground font-mono text-sm">
                {balance.payoutAddress?.slice(0, 8)}…{balance.payoutAddress?.slice(-6)}
              </code>
              <button
                type="button"
                onClick={() => balance.payoutAddress && onCopy(balance.payoutAddress)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Copy address"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
          </div>
          {balance.canSignFromDashboard ? (
            <Badge className="bg-accent/10 text-accent hover:bg-accent/10">Managed</Badge>
          ) : (
            <Badge variant="outline">External</Badge>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {balance.balances.map((b) => (
            <div key={b.currency} className="border-border/60 rounded-md border p-4">
              <div className="flex items-center gap-2">
                <TokenLogo symbol={b.currency} size={20} />
                <span className="font-poppins text-sm font-medium">{b.currency}</span>
              </div>
              <p className="font-sora text-foreground mt-2 text-2xl font-[600]">{b.formatted}</p>
              <p className="font-poppins text-muted-foreground text-[10px]">on-chain balance</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
