'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@strimz/ui'
import { EASE_OUT, MOTION_OK, gsap, useGSAP } from '../motion/gsap'
import { markMotionReady } from '../motion/gate'
import { USE_CASES, type UseCaseId } from './data'

export function UseCasesHero() {
  const scope = useRef<HTMLElement>(null)
  const [active, setActive] = useState<UseCaseId>('saas')
  const chipsRef = useRef<HTMLUListElement>(null)

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

  useEffect(() => {
    const sections = USE_CASES.map((u) => document.getElementById(u.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    const watch = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActive(top.target.id as UseCaseId)
      },
      { rootMargin: '-35% 0px -55% 0px' },
    )
    sections.forEach((s) => watch.observe(s))
    return () => watch.disconnect()
  }, [])

  useEffect(() => {
    const list = chipsRef.current
    const chip = list?.querySelector<HTMLElement>(`a[href="#${active}"]`)
    if (!list || !chip) return
    const left = chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2
    list.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [active])

  return (
    <>
      <section ref={scope} aria-labelledby="use-cases-title" className="pb-10 pt-16 sm:pt-24">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
          <p
            data-intro
            data-fade
            className="font-poppins bg-card text-foreground ring-border inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ring-1"
          >
            <span className="bg-accent size-1.5 rounded-full" />
            Use cases
          </p>
          <h1
            id="use-cases-title"
            className="font-sora text-foreground mt-5 max-w-4xl text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[60px] lg:text-[72px]"
          >
            <span className="sr-only">Built for businesses that bill online.</span>
            <span aria-hidden className="block overflow-hidden pb-[0.06em]">
              <span data-intro data-line className="block">
                Built for businesses
              </span>
            </span>
            <span aria-hidden className="block overflow-hidden pb-[0.1em]">
              <span data-intro data-line className="block">
                that bill online.
              </span>
            </span>
          </h1>
          <p
            data-intro
            data-fade
            className="font-poppins text-muted-foreground mt-6 max-w-2xl text-base leading-relaxed sm:text-lg"
          >
            Subscriptions, payment links, invoices and storefronts in one account. Here is how each
            kind of business puts them together.
          </p>
        </div>
      </section>

      <nav aria-label="Use cases" className="bg-background sticky top-16 z-30 pt-2">
        <ul
          ref={chipsRef}
          className="no-scrollbar mx-auto flex max-w-[1280px] gap-2 overflow-x-auto px-5 py-3 sm:px-10"
        >
          {USE_CASES.map((u) => (
            <li key={u.id} className="shrink-0">
              <a
                href={`#${u.id}`}
                aria-current={active === u.id ? 'true' : undefined}
                className={cn(
                  'font-poppins focus-visible:ring-accent inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2',
                  active === u.id
                    ? 'border-accent bg-accent text-ink'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {u.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
