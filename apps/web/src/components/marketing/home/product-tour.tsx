'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import restartIcon from '@iconify-icons/solar/restart-linear'
import { cn } from '@strimz/ui'
import { MkIcon } from '../icon'
import { RiseIn } from '../fx/rise-in'
import { usePrefersReducedMotion } from '../motion/reduced-motion'
import { TOUR_STEPS } from './tour-data'

const TourScene = dynamic(() => import('./tour-scene'), { ssr: false })

export function ProductTour() {
  const reducedMotion = usePrefersReducedMotion()
  const near = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState(0)
  const [replay, setReplay] = useState(0)

  useEffect(() => {
    const el = near.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMounted(true)
          observer.disconnect()
        }
      },
      { rootMargin: '100% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section aria-labelledby="tour-title" className="py-20 sm:py-28">
      <RiseIn className="mx-auto grid max-w-[1280px] gap-12 px-5 sm:px-10 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div data-rise>
          <h2
            id="tour-title"
            className="font-sora text-foreground text-[34px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[48px]"
          >
            See it in your dashboard
          </h2>
          <ol className="mt-8 space-y-6">
            {TOUR_STEPS.map((s, i) => {
              const current = !reducedMotion && mounted && i === step
              return (
                <li
                  key={s.title}
                  aria-current={current ? 'step' : undefined}
                  className={cn(
                    'border-l-2 pl-4 transition-colors duration-500',
                    current ? 'border-accent' : 'border-border',
                  )}
                >
                  <p className="font-sora text-foreground text-lg font-semibold">
                    <span className="text-muted-foreground mr-2 tabular-nums">{i + 1}</span>
                    {s.title}
                  </p>
                  <p className="font-poppins text-muted-foreground mt-1 text-[15px] leading-relaxed">
                    {s.body}
                  </p>
                </li>
              )
            })}
          </ol>
        </div>
        <div ref={near} data-rise className="min-w-0">
          {mounted ? (
            <TourScene
              key={String(reducedMotion)}
              reducedMotion={reducedMotion}
              replay={replay}
              onStep={setStep}
            />
          ) : (
            <div className="border-border bg-card aspect-[8/5] w-full rounded-[14px] border" />
          )}
          {!reducedMotion && (
            <button
              type="button"
              onClick={() => setReplay((n) => n + 1)}
              disabled={!mounted}
              className="font-poppins text-foreground border-border hover:bg-muted focus-visible:ring-accent/50 mt-5 inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
            >
              <MkIcon icon={restartIcon} className="size-4" />
              Replay
            </button>
          )}
        </div>
      </RiseIn>
    </section>
  )
}
