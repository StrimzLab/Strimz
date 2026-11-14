'use client'

import { useState } from 'react'
import { useStrimzCheckout } from '@strimz/sdk-react'
import type { Creator } from '@/lib/creators'
import { CreatorAvatar } from './CreatorAvatar'

const PRESET_AMOUNTS = ['2', '5', '10'] as const

interface TipWidgetProps {
  creator: Creator
}

/**
 * Handles the tip flow end to end:
 *   1. User picks $2 / $5 / $10 or a custom amount
 *   2. We POST /api/tip → backend mints a Strimz payment session
 *   3. `useStrimzCheckout()` opens the Strimz hosted checkout for that
 *      session id and listens for its postMessage lifecycle
 *   4. On success we swap the widget to a receipt view
 *
 * The session id created on the backend is a real Strimz session on
 * testnet — no fixtures, no mocks. Once the payer signs, the
 * scheduler + indexer marker will pick it up like any other payment.
 *
 * We use `useStrimzCheckout` directly rather than `<StrimzPayButton>`
 * so the Fanline button styling can match the rest of the UI without
 * fighting a fixed component design.
 */
export function TipWidget({ creator }: TipWidgetProps) {
  const creatorHandle = creator.handle
  const [amount, setAmount] = useState<string>('5')
  const [custom, setCustom] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<{
    txHash?: string
    amountDollars: string
    name: string
  } | null>(null)

  const chosenAmount = custom.trim() !== '' ? custom.trim() : amount

  const checkout = useStrimzCheckout({
    mode: 'popup',
    onSuccess: (txHash) => {
      setConfirmed({ txHash, amountDollars: chosenAmount, name: creator.name })
    },
    onError: (err) => setError(err.message),
  })

  async function tip() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountDollars: chosenAmount, creatorHandle }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong')
      checkout.open(body.sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare tip')
    } finally {
      setLoading(false)
    }
  }

  if (confirmed) {
    return (
      <div className="card rounded-3xl p-8 text-center" role="status">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-500/10 text-green-500">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-6 w-6"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <h3 className="font-display mt-5 text-2xl font-bold">Tip sent</h3>
        <p className="muted mt-2 text-sm">
          {confirmed.name} received ${confirmed.amountDollars} in test USDC.
        </p>
        {confirmed.txHash && (
          <p className="mt-4 break-all rounded-lg bg-black/5 p-2 font-mono text-[10px] dark:bg-white/5">
            tx: {confirmed.txHash}
          </p>
        )}
        <button
          onClick={() => setConfirmed(null)}
          className="text-brand-500 hover:text-brand-600 mt-6 text-sm font-semibold"
        >
          Send another tip
        </button>
      </div>
    )
  }

  return (
    <div className="card rounded-3xl p-7 shadow-[0_30px_70px_-40px_rgb(30_16_51/0.55)]">
      <div className="flex items-center gap-3">
        <CreatorAvatar creator={creator} size={44} />
        <div className="min-w-0">
          <h3 className="font-display truncate text-2xl font-bold leading-tight">
            Tip {creator.name.split(' ')[0]}
          </h3>
          <p className="muted truncate text-sm">
            {creator.craft} · {creator.city}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {PRESET_AMOUNTS.map((preset) => {
          const active = custom.trim() === '' && amount === preset
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setAmount(preset)
                setCustom('')
              }}
              className={
                'rounded-xl border px-4 py-3 text-left transition ' +
                (active
                  ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300'
                  : 'hover:border-brand-500/60 border-[hsl(var(--border))]')
              }
            >
              <span className="block text-lg font-semibold">${preset}</span>
              <span className="muted block text-[10px]">USDC</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        <label htmlFor="custom" className="muted text-sm">
          Your own amount <span className="muted">(optional)</span>
        </label>
        <div className="focus-within:border-brand-500 mt-1 flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2">
          <span className="muted">$</span>
          <input
            id="custom"
            type="number"
            min="1"
            step="0.01"
            placeholder="42"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="w-full bg-transparent text-lg font-medium outline-none"
          />
          <span className="muted text-xs">USDC</span>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <div className="mt-6">
        <button
          type="button"
          disabled={loading || !chosenAmount || checkout.status === 'open'}
          onClick={tip}
          className="btn btn-primary w-full"
        >
          {loading
            ? 'Preparing…'
            : checkout.status === 'open'
              ? 'Waiting for signature…'
              : `Tip $${chosenAmount || '0'}`}
        </button>
      </div>

      <p className="muted mt-4 text-center text-xs">
        Payments by <span className="text-ink font-semibold">Strimz</span>. No network fee for you.
      </p>
    </div>
  )
}
