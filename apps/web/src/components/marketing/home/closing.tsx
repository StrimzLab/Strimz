'use client'

import Image from 'next/image'
import { useRef } from 'react'
import strimzVector from '@/../public/logoIcons/StrimzVector.svg'
import { GooeyTextReveal } from '../fx/gooey-reveal'
import { PopLink } from '../fx/pop-button'
import { EASE_OUT, MOTION_OK, gsap, useGSAP, PLAY_ONCE } from '../motion/gsap'

// The two routes of the original ctaPattern.svg, traced to centre-lines; the right half mirrors them.
const ROUTES = [
  'M 56 4 L 79 27 L 399 28 L 471 76 L 725 76',
  'M -27 93 L 150 93 L 211 149 L 399 149 L 485 61 L 651 60 L 676 76 L 725 76',
]

export function Closing() {
  const scope = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap.from('[data-tile]', {
          scale: 0.4,
          rotate: -20,
          autoAlpha: 0,
          duration: 1.4,
          ease: 'back.out(1.6)',
          scrollTrigger: { trigger: '[data-circuit]', start: 'top 85%', ...PLAY_ONCE },
        })
        gsap.from('[data-route]', {
          strokeDashoffset: 900,
          duration: 1.8,
          stagger: 0.1,
          ease: EASE_OUT,
          scrollTrigger: { trigger: '[data-circuit]', start: 'top 85%', ...PLAY_ONCE },
        })
        gsap.from('[data-cta]', {
          y: 24,
          autoAlpha: 0,
          duration: 0.9,
          stagger: 0.08,
          ease: EASE_OUT,
          scrollTrigger: { trigger: scope.current, start: 'top 60%', ...PLAY_ONCE },
        })
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <section ref={scope} aria-labelledby="closing-title" className="px-2 sm:px-3">
      <div className="bg-ink grain relative isolate overflow-hidden rounded-[28px] pt-20 sm:rounded-[36px] sm:pt-28 dark:ring-1 dark:ring-white/10">
        <div
          aria-hidden
          className="absolute left-1/2 top-full -z-10 size-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(2_199_106/0.25),transparent)]"
        />
        <div className="mx-auto max-w-[900px] px-5 text-center">
          <GooeyTextReveal mode="scroll" start="top 80%" stagger={0.15}>
            <h2
              id="closing-title"
              className="font-sora text-[38px] font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-[60px] lg:text-[76px]"
            >
              Stop chasing payments.
            </h2>
            <p className="font-sora text-ink-muted text-[38px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[60px] lg:text-[76px]">
              Get paid in seconds.
            </p>
          </GooeyTextReveal>
          <p
            data-cta
            className="font-poppins text-ink-muted mx-auto mt-6 max-w-lg text-base leading-relaxed sm:text-lg"
          >
            Start free with payments, subscriptions, refunds, invoices and webhooks. No monthly fee,
            and nothing to pay on your first $1,000.
          </p>
          <div data-cta className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <PopLink href="/signup" onInk className="px-8">
              Start free
            </PopLink>
            <PopLink href="/contact" tone="neutral" onInk>
              Talk to us
            </PopLink>
          </div>
        </div>

        <div data-circuit aria-hidden className="relative mt-16 h-[151px] sm:mt-20">
          <svg
            viewBox="0 0 1450 151"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient id="pulse" x1="0" x2="1">
                <stop offset="0" stopColor="#02C76A" stopOpacity="0" />
                <stop offset="1" stopColor="#95FECC" />
              </linearGradient>
            </defs>
            {[false, true].map((mirror) => (
              <g
                key={String(mirror)}
                transform={mirror ? 'translate(1450 0) scale(-1 1)' : undefined}
              >
                {ROUTES.map((d) => (
                  <path
                    key={d}
                    data-route
                    d={d}
                    fill="none"
                    stroke="rgb(149 254 204 / 0.14)"
                    strokeWidth="1.5"
                    strokeDasharray="900"
                  />
                ))}
                {ROUTES.map((d, i) => (
                  <path
                    key={`p-${d}`}
                    d={d}
                    fill="none"
                    stroke="url(#pulse)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    pathLength={100}
                    className="circuit-pulse"
                    style={{ animationDelay: `${i * 1.3 + (mirror ? 0.65 : 0)}s` }}
                  />
                ))}
                <circle cx="56" cy="4" r="3.5" fill="#02C76A" />
                <circle cx="471" cy="76" r="3.5" fill="#02C76A" />
              </g>
            ))}
          </svg>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="relative grid size-[76px] place-items-center sm:size-[96px]">
              <span className="bg-accent/40 absolute inset-0 animate-ping rounded-[26px] motion-reduce:animate-none" />
              <span
                data-tile
                className="relative size-full drop-shadow-[0_20px_40px_rgb(2_199_106/0.55)]"
              >
                <Image src={strimzVector} alt="" width={96} height={96} className="size-full" />
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
