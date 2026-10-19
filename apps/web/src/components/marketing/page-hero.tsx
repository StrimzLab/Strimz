'use client'

import { useRef } from 'react'
import { EASE_OUT, MOTION_OK, gsap, useGSAP } from './motion/gsap'
import { markMotionReady } from './motion/gate'

export function PageHero({
  label,
  lines,
  intro,
  id,
}: {
  label: string
  lines: readonly [string, string]
  intro: string
  id: string
}) {
  const scope = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      markMotionReady()
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap
          .timeline({ defaults: { ease: EASE_OUT } })
          .set('[data-intro]', { visibility: 'visible' })
          .from('[data-line]', { yPercent: 110, duration: 1.1, stagger: 0.08 })
          .from('[data-fade]', { autoAlpha: 0, y: 16, duration: 0.8, stagger: 0.08 }, '-=0.7')
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <section ref={scope} aria-labelledby={id} className="pb-14 pt-16 sm:pt-24">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <p
          data-intro
          data-fade
          className="font-poppins bg-card text-foreground ring-border inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ring-1"
        >
          <span className="bg-accent size-1.5 rounded-full" />
          {label}
        </p>
        <h1
          id={id}
          className="font-sora text-foreground mt-5 max-w-4xl text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[60px] lg:text-[72px]"
        >
          <span className="sr-only">{lines.join(' ')}</span>
          {lines.map((line) => (
            <span key={line} aria-hidden className="block overflow-hidden pb-[0.08em]">
              <span data-intro data-line className="block">
                {line}
              </span>
            </span>
          ))}
        </h1>
        <p
          data-intro
          data-fade
          className="font-poppins text-muted-foreground mt-6 max-w-2xl text-base leading-relaxed sm:text-lg"
        >
          {intro}
        </p>
      </div>
    </section>
  )
}
