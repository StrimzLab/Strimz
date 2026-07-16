'use client'

import { useState } from 'react'
import { ArrowRightIcon, StarIcon } from './Icons'

const BENEFITS = [
  'Ad-free listening across every creator',
  'Unlimited high-fidelity streams',
  '48-hour early access to new drops',
  'VIP DMs — reach any creator, direct',
  'Cancel any time. No renegotiation.',
] as const

/**
 * Pro subscription CTA. On click we hit /api/subscribe which:
 *   1. Finds-or-creates the Fanline Pro plan on Strimz
 *   2. Returns the plan's hosted-checkout URL
 * We then redirect the whole page to the hosted checkout so the payer
 * signs the EIP-2612 permit + createSubscription in the same flow
 * Strimz already ships for the merchant dashboard.
 */
export function ProCard() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function goPro() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/subscribe', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not open subscription')
      window.location.assign(body.checkoutUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <section id="pro" className="border-t border-[hsl(var(--border))] py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="grid gap-0 overflow-hidden rounded-3xl border border-[hsl(var(--border))] md:grid-cols-2">
          <div className="from-brand-500 via-brand-600 bg-gradient-to-br to-purple-600 p-10 text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wider">
              <StarIcon className="h-3 w-3" />
              Fanline Pro
            </span>
            <h2 className="font-display mt-6 text-4xl font-semibold tracking-tight">
              Get closer to your creators.
            </h2>
            <p className="mt-4 leading-7 text-white/80">
              Recurring support that the creator actually keeps. No 30% platform cut, no card
              processor holding your funds. One monthly signature is all it takes.
            </p>
            <div className="mt-8 flex items-baseline gap-2">
              <span className="font-display text-5xl font-semibold">$5</span>
              <span className="text-white/70">/month · USDC</span>
            </div>
          </div>
          <div className="bg-[hsl(var(--card))] p-10">
            <ul className="space-y-3 text-sm">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="bg-brand-500/10 text-brand-500 mt-1 grid h-4 w-4 place-items-center rounded-full">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      className="h-2.5 w-2.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
                    </svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            {error && (
              <p className="mt-4 rounded-lg bg-red-500/10 p-2 text-xs text-red-500">{error}</p>
            )}
            <button
              type="button"
              onClick={goPro}
              disabled={loading}
              className="bg-brand-500 hover:bg-brand-600 mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Opening checkout…' : 'Go Pro'}
              {!loading && <ArrowRightIcon className="h-4 w-4" />}
            </button>
            <p className="muted mt-3 text-center text-xs">
              You&rsquo;ll sign one EIP-2612 permit + subscription setup. Cancel any time.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
