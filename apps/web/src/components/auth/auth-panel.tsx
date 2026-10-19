'use client'

import { useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Icon, type IconifyIcon } from '@iconify/react'
import boltIcon from '@iconify-icons/solar/bolt-linear'
import checkIcon from '@iconify-icons/solar/check-circle-bold'
import giftIcon from '@iconify-icons/solar/gift-linear'
import walletIcon from '@iconify-icons/solar/wallet-linear'
import { Logo } from '@/components/shared/logo'
import { EASE_OUT, MOTION_OK, gsap, useGSAP } from '@/components/marketing/motion/gsap'
import { AUTH_COPY, authVariant } from './auth-copy'

const BENEFIT_ICONS: readonly IconifyIcon[] = [boltIcon, walletIcon, giftIcon]

function SampleTag() {
  return (
    <span className="font-poppins rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70">
      Sample
    </span>
  )
}

function PaymentReceivedCard() {
  const card = AUTH_COPY.new.card
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="font-poppins flex items-center gap-2 text-sm text-white">
          <Icon icon={checkIcon} aria-hidden className="text-accent size-5" />
          {card.title}
        </span>
        <SampleTag />
      </div>
      <p className="font-sora mt-4 text-3xl font-semibold tabular-nums tracking-[-0.03em] text-white">
        {card.amount} <span className="text-ink-muted text-base font-normal">{card.unit}</span>
      </p>
      <p className="font-poppins text-ink-muted mt-1 text-xs">{card.meta}</p>
    </div>
  )
}

function MonthCard() {
  const card = AUTH_COPY.returning.card
  const max = Math.max(...card.bars)
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="font-poppins text-sm text-white">{card.title}</span>
        <SampleTag />
      </div>
      <p className="font-sora mt-4 text-3xl font-semibold tabular-nums tracking-[-0.03em] text-white">
        {card.amount} <span className="text-ink-muted text-base font-normal">{card.unit}</span>
      </p>
      <p className="font-poppins text-ink-muted mt-1 text-xs">{card.meta}</p>
      <div aria-hidden className="mt-5 flex h-14 items-end gap-1.5">
        {card.bars.map((bar, i) => (
          <span
            key={i}
            data-bar
            className="bg-accent/70 flex-1 origin-bottom rounded-sm"
            style={{ height: `${(bar / max) * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function AuthPanel() {
  const scope = useRef<HTMLDivElement>(null)
  const variant = authVariant(usePathname())

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap
          .timeline({ defaults: { ease: EASE_OUT } })
          .from('[data-panel-line]', { autoAlpha: 0, y: 24, duration: 0.9, stagger: 0.08 })
          .from('[data-panel-card]', { autoAlpha: 0, y: 40, duration: 1 }, '-=0.6')
          .from('[data-bar]', { scaleY: 0, duration: 0.6, stagger: 0.03 }, '-=0.5')
        gsap.to('[data-panel-card]', {
          y: -6,
          duration: 3,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: 1.4,
        })
      })
      return () => mm.revert()
    },
    { scope, dependencies: [variant], revertOnUpdate: true },
  )

  return (
    <div ref={scope} className="relative z-10 flex h-full flex-col justify-between gap-10">
      <Logo variant="white" className="w-[101px]" />

      {variant === 'new' ? (
        <div className="max-w-sm space-y-8">
          <h2
            data-panel-line
            className="font-sora text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-white lg:text-[34px]"
          >
            {AUTH_COPY.new.title}
          </h2>
          <ul className="space-y-4">
            {AUTH_COPY.new.benefits.map((b, i) => (
              <li key={b.title} data-panel-line className="flex gap-3">
                <span className="bg-accent/15 text-accent grid size-9 shrink-0 place-items-center rounded-xl">
                  <Icon icon={BENEFIT_ICONS[i] ?? checkIcon} aria-hidden className="size-5" />
                </span>
                <span>
                  <span className="font-poppins block text-sm font-semibold text-white">
                    {b.title}
                  </span>
                  <span className="font-poppins text-ink-muted block text-sm">{b.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <div data-panel-card>
            <PaymentReceivedCard />
          </div>
        </div>
      ) : (
        <div className="max-w-sm space-y-8">
          <div className="space-y-3">
            <h2
              data-panel-line
              className="font-sora text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-white lg:text-[34px]"
            >
              {AUTH_COPY.returning.title}
            </h2>
            <p data-panel-line className="font-poppins text-ink-muted text-[15px] leading-relaxed">
              {AUTH_COPY.returning.body}
            </p>
          </div>
          <div data-panel-card>
            <MonthCard />
          </div>
        </div>
      )}

      <p className="font-poppins text-ink-muted flex items-center gap-2 text-xs">
        <span className="bg-accent size-1.5 rounded-full" />
        Settled in USDC and EURC
      </p>
    </div>
  )
}

export function AuthBenefitsRow() {
  const variant = authVariant(usePathname())
  if (variant !== 'new') return null
  return (
    <ul aria-label="Why Strimz" className="flex flex-wrap gap-2 px-4 pb-2 sm:px-8 md:hidden">
      {AUTH_COPY.new.benefits.map((b, i) => (
        <li
          key={b.title}
          className="font-poppins border-border bg-card text-foreground flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
        >
          <Icon
            icon={BENEFIT_ICONS[i] ?? checkIcon}
            aria-hidden
            className="text-accent-ink dark:text-accent size-4"
          />
          {b.title}
        </li>
      ))}
    </ul>
  )
}
