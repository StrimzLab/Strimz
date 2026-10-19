'use client'

import { useRef } from 'react'
import checkIcon from '@iconify-icons/solar/check-circle-linear'
import minusIcon from '@iconify-icons/solar/minus-circle-linear'
import { cn } from '@strimz/ui'
import { PRICING_PLANS } from '@/lib/pricing-plans'
import { MkIcon } from '../icon'
import { BorderBeam } from '../fx/border-beam'
import { PopLink } from '../fx/pop-button'
import { EASE_OUT, MOTION_OK, PLAY_ONCE, gsap, useGSAP } from '../motion/gsap'

function spotlight(e: React.PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

export function PlanCards({
  showExcluded = false,
  className,
}: {
  showExcluded?: boolean
  className?: string
}) {
  const scope = useRef<HTMLUListElement>(null)

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
          scrollTrigger: { trigger: scope.current, start: 'top 80%', ...PLAY_ONCE },
        })
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <ul
      ref={scope}
      className={cn('grid gap-4 [perspective:1400px] sm:grid-cols-2 lg:grid-cols-4', className)}
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
            <h3 className="font-poppins text-muted-foreground text-sm font-medium">{p.name}</h3>
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
            {(showExcluded ? p.features : p.features.slice(0, 3)).map((f) => (
              <li
                key={f}
                className="font-poppins text-muted-foreground flex items-start gap-2 text-[13px]"
              >
                <MkIcon icon={checkIcon} className="text-accent mt-px size-4 shrink-0" />
                {f}
              </li>
            ))}
            {showExcluded
              ? p.excluded.map((f) => (
                  <li
                    key={f}
                    className="font-poppins text-muted-foreground/60 flex items-start gap-2 text-[13px]"
                  >
                    <MkIcon icon={minusIcon} className="mt-px size-4 shrink-0" />
                    <span>
                      <span className="sr-only">Not included: </span>
                      {f}
                    </span>
                  </li>
                ))
              : null}
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
  )
}
