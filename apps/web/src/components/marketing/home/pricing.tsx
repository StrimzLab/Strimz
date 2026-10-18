'use client'

import Link from 'next/link'
import { useId, useRef, useState } from 'react'
import checkIcon from '@iconify-icons/solar/check-circle-linear'
import { cn } from '@strimz/ui'
import { PLANS } from '@strimz/shared-config'
import { firstYearFees } from '@/lib/fee-estimate'
import { PRICING_PLANS } from '@/lib/pricing-plans'
import { MkIcon } from '../icon'
import { BorderBeam } from '../fx/border-beam'
import { PopLink } from '../fx/pop-button'
import { Odometer } from '../motion/odometer'
import { EASE_OUT, MOTION_OK, gsap, useGSAP, PLAY_ONCE } from '../motion/gsap'

const VOLUMES = [500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000]

const LADDER = (['free', 'starter', 'growth'] as const).map((id) => PLANS[id])

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

function Slider({
  label,
  stops,
  value,
  onChange,
}: {
  label: string
  stops: number[]
  value: number
  onChange: (v: number) => void
}) {
  const id = useId()
  const index = Math.max(0, stops.indexOf(value))
  const fill = (index / (stops.length - 1)) * 100
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label
          htmlFor={id}
          className="font-poppins text-foreground text-[13px] font-medium sm:text-sm"
        >
          {label} <span className="text-muted-foreground font-normal">(required)</span>{' '}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <span className="font-sora text-foreground text-lg font-semibold tabular-nums">
          {usd(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        required
        min={0}
        max={stops.length - 1}
        step={1}
        value={index}
        aria-valuetext={usd(value)}
        onChange={(e) => onChange(stops[Number(e.target.value)] ?? value)}
        style={{
          background: `linear-gradient(to right, #02C76A ${fill}%, hsl(var(--border)) ${fill}%)`,
        }}
        className="accent-accent [&::-moz-range-thumb]:border-accent [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:bg-card [&::-moz-range-thumb]:bg-card focus-visible:[&::-moz-range-thumb]:ring-accent/35 focus-visible:[&::-webkit-slider-thumb]:ring-accent/35 mt-4 h-2 w-full cursor-pointer appearance-none rounded-full focus-visible:outline-none [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 focus-visible:[&::-moz-range-thumb]:ring-4 [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:shadow-md focus-visible:[&::-webkit-slider-thumb]:ring-4"
      />
    </div>
  )
}

function spotlight(e: React.PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

export function Pricing() {
  const scope = useRef<HTMLElement>(null)
  const [monthlyVolume, setVolume] = useState(10_000)
  const year = firstYearFees(monthlyVolume)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap.from('[data-plan]', {
          y: 60,
          autoAlpha: 0,
          rotateX: 12,
          duration: 1.1,
          stagger: 0.09,
          ease: EASE_OUT,
          scrollTrigger: { trigger: '[data-plans]', start: 'top 80%', ...PLAY_ONCE },
        })
        gsap.from('[data-calc]', {
          y: 80,
          autoAlpha: 0,
          duration: 1.2,
          ease: EASE_OUT,
          scrollTrigger: { trigger: '[data-calc]', start: 'top 85%', ...PLAY_ONCE },
        })
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <section
      ref={scope}
      id="pricing"
      aria-labelledby="pricing-title"
      className="bg-muted scroll-mt-20 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <div className="max-w-2xl">
          <h2
            id="pricing-title"
            className="font-sora text-foreground text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px] lg:text-[60px]"
          >
            Pricing that gets cheaper as you grow.
          </h2>
          <p className="font-poppins text-muted-foreground mt-5 text-base leading-relaxed sm:text-lg">
            A small fee per payment and nothing else. Your first $1,000 is free, and your rate drops
            as your total grows. It never moves back up.
          </p>
        </div>

        <ul
          data-plans
          className="mt-12 grid gap-4 [perspective:1400px] sm:grid-cols-2 lg:grid-cols-4"
        >
          {PRICING_PLANS.map((p) => (
            <li
              key={p.tier}
              data-plan
              onPointerMove={spotlight}
              className={cn(
                'bg-card group relative flex flex-col overflow-hidden rounded-[24px] border p-6',
                p.featured ? 'border-accent/60' : 'border-border',
              )}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 [background:radial-gradient(260px_circle_at_var(--mx)_var(--my),rgb(2_199_106/0.12),transparent_70%)] group-hover:opacity-100"
              />
              {p.featured ? <BorderBeam size={120} duration={8} /> : null}
              <div className="flex items-center justify-between">
                <p className="font-poppins text-muted-foreground text-sm font-medium">{p.name}</p>
                {p.featured ? (
                  <span className="font-poppins bg-accent text-ink rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="font-sora text-foreground mt-4 text-[44px] font-semibold leading-none tracking-[-0.04em]">
                {p.price}
              </p>
              <p className="font-poppins text-muted-foreground mt-2 text-xs">
                {p.price === 'Custom' ? 'agreed with Strimz' : 'per transaction'}
              </p>
              <p className="font-poppins text-foreground mt-5 text-sm font-medium">{p.threshold}</p>
              <ul className="mt-4 flex-1 space-y-2.5">
                {p.features.slice(0, 3).map((f) => (
                  <li
                    key={f}
                    className="font-poppins text-muted-foreground flex items-start gap-2 text-[13px]"
                  >
                    <MkIcon icon={checkIcon} className="text-accent mt-px size-4 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <PopLink
                href={p.cta.href}
                size="md"
                tone={p.featured ? 'primary' : 'neutral'}
                className="mt-7"
              >
                {p.cta.label}
              </PopLink>
            </li>
          ))}
        </ul>
        <p className="font-poppins mt-6 text-center text-sm">
          <Link
            href="/pricing"
            className="text-muted-foreground hover:text-foreground decoration-accent underline decoration-2 underline-offset-4 transition-colors"
          >
            Compare every plan in detail
          </Link>
        </p>

        <div className="border-border bg-card mx-auto mt-16 max-w-4xl rounded-[28px] border">
          <div data-calc className="grid gap-10 p-6 sm:p-10 md:grid-cols-[1fr_1.1fr]">
            <div>
              <h3 className="font-sora text-foreground text-2xl font-semibold tracking-[-0.03em] sm:text-[28px]">
                What would your first year cost?
              </h3>
              <p className="font-poppins text-muted-foreground mt-2 text-sm">
                Move the slider to match what you take each month.
              </p>
              <div className="mt-8 space-y-8">
                <Slider
                  label="Taken each month"
                  stops={VOLUMES}
                  value={monthlyVolume}
                  onChange={setVolume}
                />
                <ol aria-label="Your rate over the year" className="space-y-2">
                  {LADDER.map((plan) => {
                    const reached = year.processed > (plan.entersAtVolume ?? 0)
                    return (
                      <li
                        key={plan.id}
                        className={cn(
                          'font-poppins flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors duration-300',
                          reached
                            ? 'border-accent/30 bg-accent/5 text-foreground'
                            : 'border-border text-muted-foreground',
                        )}
                      >
                        <span>
                          {plan.name}
                          <span className="text-muted-foreground">
                            {' '}
                            {plan.entersAtVolume
                              ? `from ${usd(plan.entersAtVolume)} all-time`
                              : `on your first ${usd(PLANS.starter.entersAtVolume ?? 0)}`}
                          </span>
                        </span>
                        <span className="font-semibold tabular-nums">
                          {((plan.feeBps ?? 0) / 100).toFixed(1)}%
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="bg-ink grain relative overflow-hidden rounded-2xl p-6">
                <div
                  aria-hidden
                  className="absolute -right-10 -top-10 size-40 rounded-full bg-[radial-gradient(closest-side,rgb(2_199_106/0.4),transparent)]"
                />
                <p className="font-poppins text-ink-muted relative text-sm">You keep</p>
                <p className="font-sora text-accent-soft relative mt-1 text-5xl font-semibold tracking-[-0.04em]">
                  <Odometer value={usd(year.kept)} />
                </p>
                <p className="font-poppins text-ink-muted relative mt-2 text-sm">
                  of {usd(year.processed)} taken in your first year
                </p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div className="border-border rounded-2xl border p-5">
                  <dt className="font-poppins text-muted-foreground text-sm">Strimz fees</dt>
                  <dd className="font-sora text-foreground mt-1 text-3xl font-semibold tracking-[-0.04em]">
                    <Odometer value={usd(year.fees)} />
                  </dd>
                </div>
                <div className="border-border rounded-2xl border p-5">
                  <dt className="font-poppins text-muted-foreground text-sm">Effective rate</dt>
                  <dd className="font-sora text-foreground mt-1 text-3xl font-semibold tracking-[-0.04em]">
                    <Odometer value={`${year.effectiveRate.toFixed(2)}%`} />
                  </dd>
                </div>
              </dl>
              <p className="font-poppins text-muted-foreground mt-4 text-xs leading-relaxed">
                Twelve months at a steady volume on the plans above. Your rate moves down as your
                all-time total grows, and never moves back up.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
