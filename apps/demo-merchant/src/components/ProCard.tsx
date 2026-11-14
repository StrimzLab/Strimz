'use client'

import { useState } from 'react'
import { ArrowRightIcon } from './Icons'
import { SoundLine } from './SoundLine'

const BENEFITS = [
  'Members-only posts, mixes and episodes',
  'Early access to new releases and show tickets',
  'A Pro badge in every creator’s comments',
  'Cancel any time, straight from Fanline',
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
    <section id="pro" className="scroll-mt-28 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="bg-ink text-paper grid overflow-hidden rounded-[2rem] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative p-8 sm:p-12">
            <p className="text-gold text-sm font-semibold">Fanline Pro</p>
            <h2 className="font-display mt-4 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
              Back them every month, not just once.
            </h2>
            <p className="mt-5 max-w-md leading-7 opacity-75">
              One monthly subscription, shared between the creators you follow. Approve it once in
              your wallet and it renews by itself.
            </p>
            <p className="mt-10 flex items-baseline gap-2">
              <span className="font-display text-6xl font-extrabold">$5</span>
              <span className="opacity-70">a month, in USDC</span>
            </p>
            <SoundLine bars={28} className="mt-10 h-14 max-w-sm opacity-90" />
          </div>
          <div className="bg-paper/[0.04] border-paper/10 flex flex-col justify-center border-t p-8 sm:p-12 lg:border-l lg:border-t-0">
            <ul className="space-y-4">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="bg-brand-500 mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                  {b}
                </li>
              ))}
            </ul>
            {error && (
              <p role="alert" className="mt-6 rounded-lg bg-red-500/15 p-2 text-xs text-red-300">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={goPro}
              disabled={loading}
              className="btn btn-primary mt-8 w-full"
            >
              {loading ? 'Opening checkout…' : 'Join Pro'}
              {!loading && <ArrowRightIcon className="h-4 w-4" />}
            </button>
            <p className="mt-3 text-center text-xs opacity-60">
              One approval sets up the monthly charge. Cancel any time.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
