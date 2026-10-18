'use client'

import { useRef, useState } from 'react'
import widgetIcon from '@iconify-icons/solar/widget-add-linear'
import linkIcon from '@iconify-icons/solar/link-round-linear'
import shieldIcon from '@iconify-icons/solar/shield-check-linear'
import moneyIcon from '@iconify-icons/solar/hand-money-linear'
import { cn } from '@strimz/ui'
import { MkIcon } from '../icon'
import { EASE_OUT, MOTION_OK, gsap, useGSAP, PLAY_ONCE } from '../motion/gsap'
import { ApproveScene, CreateScene, PaidScene, ShareScene } from './flow-scenes'

const STEPS = [
  {
    icon: widgetIcon,
    tone: 'bg-accent/10 text-accent',
    title: 'Create a plan or a link',
    body: 'Set a price in USDC or EURC, choose one-time or monthly, and add a trial if you want one. No code needed.',
    Scene: CreateScene,
  },
  {
    icon: linkIcon,
    tone: 'bg-step-blue/10 text-step-blue',
    title: 'Share your checkout',
    body: 'Send the link, embed it on your site, or list it in your storefront.',
    Scene: ShareScene,
  },
  {
    icon: shieldIcon,
    tone: 'bg-step-purple/10 text-step-purple',
    title: 'Your customer approves once',
    body: 'They pay from their own wallet. For a subscription, one approval covers every renewal, and Strimz pays the network fee.',
    Scene: ApproveScene,
  },
  {
    icon: moneyIcon,
    tone: 'bg-step-red/10 text-step-red',
    title: 'The money is yours in seconds',
    body: 'Each payment settles on Arc straight into your wallet, minus the fee. Your customer gets a receipt and you get a record.',
    Scene: PaidScene,
  },
] as const

type SceneKey = 'create' | 'share' | 'approve' | 'paid'

function countUp(el: Element | null, to: number, duration: number) {
  const value = { n: 0 }
  return gsap.fromTo(
    value,
    { n: 0 },
    {
      n: to,
      duration,
      ease: 'power1.out',
      onUpdate: () => {
        if (el) el.textContent = value.n.toFixed(2)
      },
    },
  )
}

/** One scene's choreography, in natural seconds. Desktop scrubs it inside the pin; phones play it once. */
function sceneTimeline(scene: Element, key: SceneKey) {
  const q = gsap.utils.selector(scene)
  const tl = gsap.timeline({ defaults: { ease: EASE_OUT } })
  if (key === 'create') {
    tl.from(q('[data-type-name]'), { width: 0, duration: 0.5, ease: 'steps(3)' })
      .add(countUp(q('[data-price]')[0] ?? null, 49, 0.8), 0.3)
      .from(q('[data-currency-pill]'), { xPercent: 100, duration: 0.4 }, 1)
      .from(q('[data-toggle-knob]'), { x: -16, duration: 0.35 }, 1.3)
      .from(q('[data-created]'), { autoAlpha: 0, scale: 0.94, duration: 0.45 }, 1.8)
  }
  if (key === 'share') {
    tl.from(q('[data-link]'), { scale: 0.92, autoAlpha: 0, duration: 0.5 })
      .from(q('[data-channel]'), { x: -18, autoAlpha: 0, stagger: 0.15, duration: 0.45 }, 0.3)
      .from(q('[data-qr]'), { rotate: -8, scale: 0.85, autoAlpha: 0, duration: 0.6 }, 0.5)
      .from(q('[data-copied]'), { autoAlpha: 0, y: 6, duration: 0.3 }, 1.4)
  }
  if (key === 'approve') {
    tl.from(q('[data-wallet]'), { y: 80, rotateX: 18, autoAlpha: 0, duration: 0.8 })
      .to(
        q('[data-approve]'),
        { scale: 0.95, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.inOut' },
        0.9,
      )
      .fromTo(q('[data-approving]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 1.15)
      .to(q('[data-approving]'), { autoAlpha: 0, duration: 0.15 }, 2.1)
      .from(q('[data-approved]'), { autoAlpha: 0, scale: 0.96, duration: 0.3 }, 2.1)
  }
  if (key === 'paid') {
    tl.add(countUp(q('[data-balance]')[0] ?? null, 49, 1))
      .from(q('[data-renew-line]'), { scaleY: 0, duration: 0.9, ease: 'power2.inOut' }, 0.3)
      .from(q('[data-renewal]'), { autoAlpha: 0, x: 12, stagger: 0.2, duration: 0.4 }, 0.3)
      .from(q('[data-notify]'), { autoAlpha: 0, y: 10, stagger: 0.12, duration: 0.4 }, 1.1)
  }
  return tl
}

export function HowItWorks() {
  const scope = useRef<HTMLElement>(null)
  const [active, setActive] = useState(STEPS.length - 1)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      const resetNumbers = () =>
        gsap.utils
          .selector(scope)('[data-price], [data-balance]')
          .forEach((el) => (el.textContent = '49.00'))

      mm.add(`${MOTION_OK} and (min-width: 1024px)`, () => {
        setActive(0)
        const q = gsap.utils.selector(scope)
        const scenes = q('[data-stage] [data-scene]')
        gsap.set(scenes.slice(1), { autoAlpha: 0 })

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: '[data-pin]',
            start: 'top top',
            end: `+=${STEPS.length * 85}%`,
            pin: true,
            scrub: 0.6,
            onUpdate: (self) => {
              setActive(
                Math.min(STEPS.length - 1, Math.floor(self.progress * STEPS.length * 0.999)),
              )
            },
          },
        })
        tl.fromTo('[data-rail]', { scaleY: 0 }, { scaleY: 1, duration: STEPS.length }, 0)

        scenes.forEach((scene, i) => {
          const key = scene.getAttribute('data-scene') as SceneKey
          const inner = sceneTimeline(scene, key)
          tl.add(inner.timeScale(inner.duration() / 0.7), i + 0.08)
          const next = scenes[i + 1]
          if (!next) return
          tl.to(
            scene,
            { autoAlpha: 0, y: -24, filter: 'blur(6px)', duration: 0.18 },
            i + 0.9,
          ).fromTo(
            next,
            { autoAlpha: 0, y: 32, filter: 'blur(6px)' },
            { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.22 },
            i + 0.96,
          )
        })
        tl.to({}, { duration: 0.2 }, STEPS.length - 0.2)

        gsap.from(q('[data-stage-card]'), {
          y: 60,
          autoAlpha: 0,
          duration: 1.2,
          ease: EASE_OUT,
          scrollTrigger: { trigger: '[data-pin]', start: 'top 80%', ...PLAY_ONCE },
        })
        return () => {
          setActive(STEPS.length - 1)
          resetNumbers()
        }
      })

      mm.add(`${MOTION_OK} and (max-width: 1023px)`, () => {
        gsap.utils
          .selector(scope)('[data-mobile-scene]')
          .forEach((card) => {
            const scene = card.querySelector('[data-scene]')
            if (!scene) return
            const tl = gsap.timeline({
              scrollTrigger: { trigger: card, start: 'top 80%', ...PLAY_ONCE },
            })
            tl.from(card, { y: 50, autoAlpha: 0, duration: 0.8, ease: EASE_OUT }).add(
              sceneTimeline(scene, scene.getAttribute('data-scene') as SceneKey),
              0.2,
            )
          })
        return resetNumbers
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <section
      ref={scope}
      id="how-it-works"
      aria-labelledby="how-title"
      className="bg-muted scroll-mt-20"
    >
      <div
        data-pin
        className="mx-auto grid max-w-[1280px] gap-12 px-5 py-20 sm:px-10 lg:h-svh lg:grid-cols-[0.9fr_1fr] lg:items-center lg:gap-16 lg:py-0"
      >
        <div>
          <p className="font-poppins bg-card text-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium shadow-[0_1px_2px_rgb(5_0_32/0.06)] ring-1 ring-black/5">
            <span className="bg-accent size-1.5 rounded-full" />
            How it works
          </p>
          <h2
            id="how-title"
            className="font-sora text-foreground mt-5 text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px] lg:text-[56px]"
          >
            From link to paid, in seconds.
          </h2>

          <ol className="relative mt-8 space-y-1.5">
            <span
              aria-hidden
              className="bg-border absolute bottom-6 left-[27px] top-6 hidden w-px lg:block"
            />
            <span
              aria-hidden
              data-rail
              className="bg-accent absolute bottom-6 left-[27px] top-6 hidden w-px origin-top lg:block"
            />
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                aria-current={i === active ? 'step' : undefined}
                className={cn(
                  'relative rounded-2xl p-3 transition-[opacity,background-color] duration-500 lg:flex lg:gap-4',
                  i === active && 'lg:bg-card lg:shadow-[0_20px_50px_-30px_rgb(5_0_32/0.4)]',
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Opaque backing so the progress rail never shows through a dimmed tile. */}
                  <span className="bg-muted relative z-10 grid size-[46px] shrink-0 place-items-center rounded-xl">
                    <span
                      className={cn(
                        'grid size-full place-items-center rounded-[inherit] transition-opacity duration-500',
                        step.tone,
                        i !== active && 'lg:opacity-45',
                      )}
                    >
                      <MkIcon icon={step.icon} className="size-[22px]" />
                    </span>
                  </span>
                  <div
                    className={cn(
                      'transition-opacity duration-500',
                      i !== active && 'lg:opacity-45',
                    )}
                  >
                    <p className="font-poppins text-muted-foreground text-xs">Step {i + 1} of 4</p>
                    <h3 className="font-sora text-foreground mt-0.5 text-lg font-semibold tracking-[-0.02em]">
                      {step.title}
                    </h3>
                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-500',
                        i === active ? 'lg:min-h-[77px] lg:grid-rows-[1fr]' : 'lg:grid-rows-[0fr]',
                      )}
                    >
                      <p className="font-poppins text-muted-foreground mt-1 max-w-md overflow-hidden text-[15px] leading-relaxed">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  aria-hidden
                  data-mobile-scene
                  className="border-border bg-card mt-5 overflow-hidden rounded-[24px] border lg:hidden"
                >
                  <step.Scene />
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div aria-hidden className="hidden lg:block">
          <div
            data-stage-card
            className="border-border bg-card relative overflow-hidden rounded-[32px] border shadow-[0_40px_90px_-40px_rgb(5_0_32/0.45)]"
          >
            <div className="border-border bg-muted/60 flex items-center gap-2 border-b px-5 py-3">
              <span className="bg-window-close size-2.5 rounded-full" />
              <span className="bg-window-minimize size-2.5 rounded-full" />
              <span className="bg-window-zoom size-2.5 rounded-full" />
              <span className="font-poppins text-muted-foreground ml-3 text-xs">
                Strimz dashboard
              </span>
            </div>
            <div data-stage className="relative h-[380px] [perspective:1200px]">
              {STEPS.map((step) => (
                <div key={step.title} className="absolute inset-0">
                  <step.Scene />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
