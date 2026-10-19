'use client'

import { useRef } from 'react'
import dollarIcon from '@iconify-icons/solar/dollar-linear'
import graphIcon from '@iconify-icons/solar/graph-up-linear'
import transferIcon from '@iconify-icons/solar/transfer-horizontal-linear'
import { PLANS } from '@strimz/shared-config'
import { MkIcon } from '../icon'
import { EASE_OUT, MOTION_OK, PLAY_ONCE, gsap, useGSAP } from '../motion/gsap'

const STOPS = (['free', 'starter', 'growth'] as const).map((id) => {
  const plan = PLANS[id]
  return {
    id,
    name: plan.name,
    rate: `${(plan.feeBps ?? 0) / 100}%`,
    from: plan.entersAtVolume
      ? `from $${plan.entersAtVolume.toLocaleString('en-US')} all-time`
      : 'from sign-up',
  }
})

const STARTER = (PLANS.starter.entersAtVolume ?? 0).toLocaleString('en-US')

const FACTS = [
  {
    icon: dollarIcon,
    title: 'Counts per currency',
    body: `${STARTER} USDC or ${STARTER} EURC moves you up. The two are not added together.`,
  },
  {
    icon: graphIcon,
    title: 'Never moves back down',
    body: 'A quiet month does not cost you your rate. Plans only move up.',
  },
  {
    icon: transferIcon,
    title: 'Taken in the same transaction',
    body: 'The fee comes out on-chain as the payment settles. There is no separate invoice.',
  },
] as const

export function PlanRail() {
  const scope = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add({ motion: MOTION_OK, wide: '(min-width: 768px)' }, (ctx) => {
        if (!ctx.conditions?.motion) return
        if (ctx.conditions.wide) {
          gsap.fromTo(
            '[data-rail-fill]',
            { scaleX: 0 },
            {
              scaleX: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: '[data-rail]',
                start: 'top 75%',
                end: 'bottom 45%',
                scrub: 0.6,
              },
            },
          )
        } else {
          gsap.utils.toArray<HTMLElement>('[data-seg-fill]').forEach((seg) => {
            gsap.fromTo(
              seg,
              { scaleY: 0 },
              {
                scaleY: 1,
                ease: 'none',
                scrollTrigger: { trigger: seg, start: 'top 70%', end: 'bottom 70%', scrub: 0.6 },
              },
            )
          })
        }
        gsap.utils.toArray<HTMLElement>('[data-stop]').forEach((stop) => {
          gsap.from(stop.querySelector('[data-dot]'), {
            scale: 0.4,
            duration: 0.6,
            ease: 'back.out(3)',
            scrollTrigger: { trigger: stop, start: 'top 70%', ...PLAY_ONCE },
          })
        })
        gsap.from('[data-fact]', {
          y: 30,
          autoAlpha: 0,
          duration: 0.9,
          stagger: 0.08,
          ease: EASE_OUT,
          scrollTrigger: { trigger: '[data-facts]', start: 'top 85%', ...PLAY_ONCE },
        })
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <section ref={scope} aria-labelledby="rail-title" className="py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <h2
          id="rail-title"
          className="font-sora text-foreground max-w-2xl text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px]"
        >
          How plans move up.
        </h2>
        <p className="font-poppins text-muted-foreground mt-4 max-w-xl text-base leading-relaxed sm:text-lg">
          Everyone starts on {PLANS.free.name}. Your rate drops on its own as your all-time volume
          grows.
        </p>

        <ol data-rail className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-0">
          <span
            aria-hidden
            className="bg-border absolute left-3 right-[calc(33.333%-12px)] top-[11px] hidden h-0.5 md:block"
          />
          <span
            aria-hidden
            data-rail-fill
            className="bg-accent absolute left-3 right-[calc(33.333%-12px)] top-[11px] hidden h-0.5 origin-left md:block"
          />
          {STOPS.map((stop, i) => (
            <li
              key={stop.id}
              data-stop
              className="relative flex gap-5 md:block md:pr-8 md:last:pr-0"
            >
              {i < STOPS.length - 1 ? (
                <>
                  <span
                    aria-hidden
                    className="bg-border absolute -bottom-10 left-[11px] top-3 w-0.5 md:hidden"
                  />
                  <span
                    aria-hidden
                    data-seg-fill
                    className="bg-accent absolute -bottom-10 left-[11px] top-3 w-0.5 origin-top md:hidden"
                  />
                </>
              ) : null}
              <span
                data-dot
                aria-hidden
                className="bg-accent ring-background relative z-10 grid size-6 shrink-0 place-items-center rounded-full ring-8"
              >
                <span className="bg-ink size-2 rounded-full" />
              </span>
              <div className="md:mt-6">
                <p className="font-poppins text-muted-foreground text-sm">{stop.name}</p>
                <p className="font-sora text-foreground mt-1 text-[44px] font-semibold tabular-nums leading-none tracking-[-0.04em]">
                  {stop.rate}
                </p>
                <p className="font-poppins text-muted-foreground mt-2 text-sm">{stop.from}</p>
              </div>
            </li>
          ))}
        </ol>

        <ul data-facts className="mt-16 grid gap-4 md:grid-cols-3">
          {FACTS.map((fact) => (
            <li
              key={fact.title}
              data-fact
              className="border-border bg-card rounded-[22px] border p-6"
            >
              <span className="bg-accent/10 text-accent-ink dark:text-accent grid size-10 place-items-center rounded-xl">
                <MkIcon icon={fact.icon} className="size-5" />
              </span>
              <h3 className="font-sora text-foreground mt-5 text-lg font-semibold tracking-[-0.02em]">
                {fact.title}
              </h3>
              <p className="font-poppins text-muted-foreground mt-2 text-sm leading-relaxed">
                {fact.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
