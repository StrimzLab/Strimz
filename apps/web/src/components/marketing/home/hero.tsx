'use client'

import { useRef } from 'react'
import boltIcon from '@iconify-icons/solar/bolt-linear'
import shieldIcon from '@iconify-icons/solar/shield-check-linear'
import walletIcon from '@iconify-icons/solar/wallet-linear'
import transferIcon from '@iconify-icons/solar/transfer-horizontal-linear'
import { MkIcon } from '../icon'
import { BorderBeam } from '../fx/border-beam'
import { MorphWord } from '../fx/morph-word'
import { PopLink } from '../fx/pop-button'
import { MOTION_OK, gsap, useGSAP } from '@strimz/web-shared/components/marketing/motion/gsap'
import { introOrder } from '../motion/intro'
import { DashboardPreview } from './dashboard-preview'
import { siteUrls } from '@strimz/web-shared/lib/site-urls'

const AUDIENCES = ['SaaS teams.', 'marketplaces.', 'creators.', 'agencies.', 'global B2B.'] as const

const FACTS = [
  { icon: boltIcon, label: 'Settles in seconds' },
  { icon: shieldIcon, label: 'Non-custodial' },
  { icon: walletIcon, label: 'Paid into your own wallet' },
  { icon: transferIcon, label: 'USDC and EURC' },
] as const

export function Hero() {
  const scope = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      // The intro is CSS (globals.css), so it plays before hydration (#496).
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap.to('[data-copy]', {
          y: -80,
          autoAlpha: 0.2,
          ease: 'none',
          scrollTrigger: {
            trigger: scope.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        })
        gsap.to('[data-dash-wrap]', {
          y: -40,
          scale: 0.95,
          ease: 'none',
          scrollTrigger: {
            trigger: scope.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        })
      })

      mm.add(`${MOTION_OK} and (hover: hover) and (pointer: fine) and (min-width: 1024px)`, () => {
        const card = scope.current?.querySelector('[data-dash]')
        if (!card) return
        const rx = gsap.quickTo(card, 'rotateX', { duration: 0.8, ease: 'power3' })
        const ry = gsap.quickTo(card, 'rotateY', { duration: 0.8, ease: 'power3' })
        const onMove = (e: PointerEvent) => {
          rx((0.5 - e.clientY / window.innerHeight) * 8)
          ry((e.clientX / window.innerWidth - 0.5) * 10)
        }
        const onLeave = () => {
          rx(0)
          ry(0)
        }
        window.addEventListener('pointermove', onMove, { passive: true })
        document.documentElement.addEventListener('pointerleave', onLeave)
        return () => {
          window.removeEventListener('pointermove', onMove)
          document.documentElement.removeEventListener('pointerleave', onLeave)
        }
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <section ref={scope} aria-labelledby="hero-title">
      <div className="relative isolate overflow-hidden">
        <div className="relative mx-auto grid max-w-[1280px] items-center gap-14 px-5 pb-10 pt-16 sm:px-10 sm:pt-24 lg:min-h-[calc(100svh-96px)] lg:grid-cols-[1.2fr_1fr] lg:gap-10 lg:pb-16 lg:pt-20">
          <div data-copy>
            <h1
              id="hero-title"
              className="font-sora text-foreground text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[60px] lg:text-[56px] xl:text-[72px] dark:text-white"
            >
              <span className="sr-only">
                Stablecoin billing for SaaS teams, marketplaces, creators, agencies and global B2B.
              </span>
              <span aria-hidden className="block overflow-hidden pb-[0.06em]">
                <span data-intro data-line style={introOrder(0)} className="block">
                  Stablecoin billing
                </span>
              </span>
              <span aria-hidden className="block overflow-hidden pb-[0.1em]">
                <span data-intro data-line style={introOrder(1)} className="block">
                  for{' '}
                  <span className="text-accent-deep dark:text-accent-bright">
                    <MorphWord words={AUDIENCES} />
                  </span>
                </span>
              </span>
            </h1>

            <p
              data-intro
              data-fade
              style={introOrder(1)}
              className="font-poppins text-muted-foreground dark:text-ink-muted mt-6 max-w-[34rem] text-base leading-[1.7] sm:text-lg"
            >
              Take one-time and recurring payments in USDC and EURC. Your customer approves once,
              you get paid every period, and the money lands in your own wallet in seconds.
            </p>

            <div
              data-intro
              data-fade
              style={introOrder(0)}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <PopLink href={`${siteUrls.dashboard}/signup`}>Start free</PopLink>
              <PopLink href="#how-it-works" tone="neutral">
                See how it works
              </PopLink>
            </div>
            <p
              data-intro
              data-fade
              style={introOrder(2)}
              className="font-poppins text-muted-foreground mt-5 text-[13px] dark:text-white/55"
            >
              Free to start. 0% fees on your first $1,000, and no monthly fee.
            </p>
          </div>

          <div data-dash-wrap className="flex justify-center [perspective:1400px] lg:justify-end">
            <div
              data-intro
              data-dash
              className="relative w-full max-w-[560px] [transform-style:preserve-3d]"
            >
              <DashboardPreview />
              <div className="pointer-events-none absolute inset-0 z-10 rounded-[14px]">
                <BorderBeam size={180} duration={10} />
              </div>
            </div>
          </div>
        </div>

        <ul className="border-border relative mx-auto grid max-w-[1280px] grid-cols-2 gap-x-6 gap-y-4 border-t px-5 py-6 sm:px-10 lg:grid-cols-4 dark:border-white/10">
          {FACTS.map((f, i) => (
            <li
              key={f.label}
              data-intro
              data-fact
              style={introOrder(i)}
              className="font-poppins text-muted-foreground flex items-center gap-2.5 text-[13px] sm:text-sm dark:text-white/70"
            >
              <MkIcon icon={f.icon} className="text-brand-text size-5 shrink-0" />
              {f.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
