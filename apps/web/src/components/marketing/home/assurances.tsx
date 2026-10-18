'use client'

import { useRef } from 'react'
import shieldIcon from '@iconify-icons/solar/shield-check-linear'
import repeatIcon from '@iconify-icons/solar/repeat-linear'
import boltIcon from '@iconify-icons/solar/bolt-linear'
import art1 from '@/../public/art/1.svg'
import art2 from '@/../public/art/2.svg'
import art3 from '@/../public/art/3.svg'
import { PaddedLines } from '@/components/shared/padded-lines'
import { MkIcon } from '../icon'
import { ArtImage } from '../fx/art-image'
import { LightLines } from '../fx/light-lines'
import { EASE_OUT, MOTION_OK, gsap, useGSAP, PLAY_ONCE } from '../motion/gsap'

const ITEMS = [
  {
    art: art1,
    icon: shieldIcon,
    title: 'Charges that can’t happen twice',
    body: 'Each billing period can only be paid once. If a charge is retried, the contract refuses the second one, so a customer is never billed twice for the same month.',
  },
  {
    art: art2,
    icon: repeatIcon,
    title: 'One approval, every renewal',
    body: 'Your customer approves once from their own wallet. Strimz charges each period on schedule until they cancel, and pays the network fee for them.',
  },
  {
    art: art3,
    icon: boltIcon,
    title: 'Paid in seconds',
    body: 'Each payment settles on Arc straight into a wallet you control. Strimz never holds your money, and the transaction is your receipt.',
  },
] as const

export function Assurances() {
  const scope = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        const q = gsap.utils.selector(scope)
        gsap.from(q('[data-title-line]'), {
          yPercent: 110,
          duration: 1.1,
          stagger: 0.08,
          ease: EASE_OUT,
          scrollTrigger: { trigger: scope.current, start: 'top 70%', ...PLAY_ONCE },
        })
        q('[data-item]').forEach((item, i) => {
          gsap.from(item, {
            y: 70,
            autoAlpha: 0,
            duration: 1.1,
            delay: i * 0.12,
            ease: EASE_OUT,
            scrollTrigger: { trigger: item, start: 'top 88%', ...PLAY_ONCE },
          })
        })
        q('[data-coin]').forEach((coin, i) => {
          gsap.to(coin, {
            y: -14,
            rotate: i % 2 ? -6 : 6,
            duration: 2.6 + i * 0.4,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          })
          gsap.fromTo(
            coin.parentElement,
            { y: 50 + i * 30 },
            {
              y: -30 - i * 20,
              ease: 'none',
              scrollTrigger: {
                trigger: scope.current,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            },
          )
        })
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <section ref={scope} aria-labelledby="assure-title" className="px-2 py-2 sm:px-3">
      <div className="bg-ink grain relative isolate overflow-hidden rounded-[28px] sm:rounded-[36px] dark:ring-1 dark:ring-white/10">
        <LightLines className="-z-10" />
        <div
          aria-hidden
          className="from-ink absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b to-transparent"
        />
        <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-10 sm:py-28 lg:py-32">
          <h2
            id="assure-title"
            className="font-sora max-w-[18ch] text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] text-white sm:text-[48px] lg:text-[60px]"
          >
            <span className="block overflow-hidden pb-[0.08em]">
              <span data-title-line className="block">
                Money that arrives,
              </span>
            </span>
            <span className="block overflow-hidden pb-[0.08em]">
              <span data-title-line className="text-accent-soft block">
                and stays arrived.
              </span>
            </span>
          </h2>
          <ul className="mt-14 grid gap-5 lg:mt-20 lg:grid-cols-3 lg:gap-6">
            {ITEMS.map((item) => (
              <li
                key={item.title}
                data-item
                className="relative rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm sm:p-8 md:grid md:grid-cols-[140px_1fr] md:content-center md:gap-x-10 lg:block"
              >
                <div className="relative h-[108px] md:row-span-2 md:self-center">
                  <div
                    aria-hidden
                    className="absolute left-2 top-6 size-24 rounded-full bg-[radial-gradient(closest-side,rgb(2_199_106/0.35),transparent)] blur-md"
                  />
                  <div>
                    <div data-coin className="w-fit">
                      <ArtImage
                        src={item.art}
                        size={96}
                        fallback={<MkIcon icon={item.icon} className="text-accent size-12" />}
                      />
                    </div>
                  </div>
                </div>
                <h3 className="font-sora mt-8 self-end text-[22px] font-semibold leading-tight tracking-[-0.02em] text-white md:mt-0 lg:mt-8">
                  {item.title}
                </h3>
                <p className="font-poppins text-ink-muted mt-3 text-[15px] leading-[1.7]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <PaddedLines className="mx-auto mt-2 max-w-[calc(100%-8px)] overflow-hidden rounded-full [&>div]:h-[6px]" />
    </section>
  )
}
