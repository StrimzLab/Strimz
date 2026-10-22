'use client'

import Link from 'next/link'
import { useRef } from 'react'
import checkIcon from '@iconify-icons/solar/check-circle-linear'
import arrowIcon from '@iconify-icons/solar/arrow-right-linear'
import infoIcon from '@iconify-icons/solar/info-circle-linear'
import { cn } from '@strimz/ui'
import { MkIcon } from '../icon'
import { EASE_OUT, MOTION_OK, PLAY_ONCE, gsap, useGSAP } from '../motion/gsap'
import { InvoicesMock, SubscriptionsMock } from '../home/billing-mocks'
import { EurcLinkMock, OrderMock, StorefrontMock } from './mocks'
import { sampleCost, type MockKind, type UseCase } from './data'

const MOCKS: Record<MockKind, () => React.JSX.Element> = {
  subscriptions: SubscriptionsMock,
  order: OrderMock,
  storefront: StorefrontMock,
  invoice: InvoicesMock,
  'payment-link': EurcLinkMock,
}

const amount = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

export function UseCaseSection({ useCase, flip }: { useCase: UseCase; flip: boolean }) {
  const scope = useRef<HTMLElement>(null)
  const Mock = MOCKS[useCase.mock]
  const { sample } = useCase
  const cost = sampleCost(sample)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap.from('[data-uc-copy] > *', {
          y: 30,
          autoAlpha: 0,
          duration: 0.9,
          stagger: 0.07,
          ease: EASE_OUT,
          scrollTrigger: { trigger: scope.current, start: 'top 75%', ...PLAY_ONCE },
        })
        gsap.from('[data-uc-art]', {
          y: 60,
          autoAlpha: 0,
          rotateX: 10,
          duration: 1.1,
          ease: EASE_OUT,
          scrollTrigger: { trigger: scope.current, start: 'top 75%', ...PLAY_ONCE },
        })
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <section
      ref={scope}
      id={useCase.id}
      aria-labelledby={`${useCase.id}-title`}
      className="scroll-mt-40 py-16 sm:py-24"
    >
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 sm:px-10 lg:grid-cols-2 lg:gap-16">
        <div data-uc-copy className={cn(flip && 'lg:order-2')}>
          <p className="font-poppins bg-accent/10 text-accent-ink dark:text-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium">
            <span className="bg-accent size-1.5 rounded-full" />
            {useCase.label}
          </p>
          <h2
            id={`${useCase.id}-title`}
            className="font-sora text-foreground mt-4 text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[40px]"
          >
            {useCase.title}
          </h2>
          <p className="font-poppins text-muted-foreground mt-4 max-w-xl text-base leading-relaxed">
            {useCase.job}
          </p>
          <ul className="mt-7 space-y-4">
            {useCase.features.map((f) => (
              <li key={f.title} className="flex gap-3">
                <MkIcon icon={checkIcon} className="text-accent mt-0.5 size-5 shrink-0" />
                <div>
                  <Link
                    href={f.href}
                    className="font-poppins text-foreground decoration-accent group inline-flex items-center gap-1.5 text-[15px] font-semibold underline-offset-4 hover:underline"
                  >
                    {f.title}
                    <MkIcon
                      icon={arrowIcon}
                      className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                    />
                  </Link>
                  <p className="font-poppins text-muted-foreground mt-1 text-sm leading-relaxed">
                    {f.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {useCase.limit ? (
            <p className="font-poppins border-border text-muted-foreground mt-6 flex gap-2 rounded-xl border px-4 py-3 text-sm">
              <MkIcon icon={infoIcon} className="mt-0.5 size-4 shrink-0" />
              {useCase.limit}
            </p>
          ) : null}
        </div>

        <div className={cn('[perspective:1400px]', flip && 'lg:order-1')}>
          <div data-uc-art className="mx-auto max-w-[520px]">
            <Mock />
            <dl className="border-border bg-card mt-4 rounded-2xl border p-5">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-poppins text-muted-foreground text-xs font-medium">
                  If you bill
                </dt>
                <dd className="font-poppins text-foreground text-sm tabular-nums">
                  {amount(sample.count)} {sample.unit} × {amount(sample.unitAmount)}{' '}
                  {sample.currency} = {amount(sample.monthlyVolume)} {sample.currency} a month
                </dd>
              </div>
              <div className="border-border mt-3 flex items-baseline justify-between gap-3 border-t pt-3">
                <dt className="font-poppins text-muted-foreground text-xs">
                  First-year Strimz fees
                </dt>
                <dd className="font-sora text-foreground text-lg font-semibold tabular-nums">
                  {amount(cost.fees)} {sample.currency}{' '}
                  <span className="text-muted-foreground text-sm font-normal">
                    ({cost.effectiveRate.toFixed(2)}%)
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
