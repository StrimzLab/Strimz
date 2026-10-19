'use client'

import { useId, useRef, useState } from 'react'
import { cn } from '@strimz/ui'
import { PLANS } from '@strimz/shared-config'
import { firstYearFees, planAfterYear } from '@/lib/fee-estimate'
import { Odometer } from '../motion/odometer'
import { EASE_OUT, MOTION_OK, PLAY_ONCE, gsap, useGSAP } from '../motion/gsap'

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

export function FeeCalculator({ className }: { className?: string }) {
  const scope = useRef<HTMLDivElement>(null)
  const [monthlyVolume, setVolume] = useState(10_000)
  const year = firstYearFees(monthlyVolume)
  const endPlan = planAfterYear(monthlyVolume)
  const endIndex = LADDER.findIndex((plan) => plan.id === endPlan)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap.from(scope.current, {
          y: 80,
          autoAlpha: 0,
          duration: 1.2,
          ease: EASE_OUT,
          scrollTrigger: { trigger: scope.current, start: 'top 85%', ...PLAY_ONCE },
        })
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <div
      ref={scope}
      className={cn('border-border bg-card mx-auto max-w-4xl rounded-[28px] border', className)}
    >
      <div className="grid gap-10 p-6 sm:p-10 md:grid-cols-[1fr_1.1fr]">
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
              {LADDER.map((plan, i) => (
                <li
                  key={plan.id}
                  aria-current={i === endIndex ? 'step' : undefined}
                  className={cn(
                    'font-poppins flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors duration-300',
                    i <= endIndex
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
              ))}
            </ol>
          </div>
        </div>
        <div className="flex flex-col justify-center" aria-live="polite">
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
            <div className="border-border col-span-2 flex items-center justify-between rounded-2xl border px-5 py-4">
              <dt className="font-poppins text-muted-foreground text-sm">Your plan by month 12</dt>
              <dd className="font-sora text-foreground text-lg font-semibold">
                {PLANS[endPlan].name}{' '}
                <span className="text-muted-foreground font-normal tabular-nums">
                  {((PLANS[endPlan].feeBps ?? 0) / 100).toFixed(1)}%
                </span>
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
  )
}
