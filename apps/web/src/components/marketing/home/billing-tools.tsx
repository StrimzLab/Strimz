'use client'

import Link from 'next/link'
import { useRef } from 'react'
import checkIcon from '@iconify-icons/solar/check-circle-linear'
import arrowIcon from '@iconify-icons/solar/arrow-right-linear'
import { cn } from '@strimz/ui'
import { MkIcon } from '../icon'
import { EASE_OUT, MOTION_OK, gsap, useGSAP, PLAY_ONCE } from '../motion/gsap'
import {
  AnalyticsMock,
  InvoicesMock,
  RecoveryMock,
  RefundsMock,
  SubscriptionsMock,
} from './billing-mocks'

const SHEETS = [
  {
    key: 'subscriptions',
    chip: 'Subscriptions',
    title: 'Recurring revenue, without the chasing.',
    body: 'Daily, weekly, monthly, quarterly or yearly. Your customer approves once and Strimz charges them on schedule, with free trials if you want them.',
    points: [
      'One approval covers every renewal',
      'Customers can cancel from their own wallet',
      'Strimz pays the network fee on every charge',
    ],
    href: '/docs/guides/subscriptions',
    cta: 'How subscriptions work',
    Mock: SubscriptionsMock,
  },
  {
    key: 'recovery',
    chip: 'Recovery',
    title: 'Failed payments that fix themselves.',
    body: 'When a renewal fails, Strimz retries it for up to 48 hours after the period ends. Turn on reminder emails and your customer is asked to top up.',
    points: [
      'Retries at 15 minutes, then 1, 3, 6, 12 and 24 hours',
      'Optional reminder emails, sent for you',
      'You hear about it either way',
    ],
    href: '/docs/subscriptions/recovery',
    cta: 'How recovery works',
    Mock: RecoveryMock,
  },
  {
    key: 'refunds',
    chip: 'Refunds',
    title: 'Refunds with a clear paper trail.',
    body: 'Refund all or part of a payment. You approve the transfer from your own wallet and the dashboard records it the moment it settles.',
    points: [
      'Never more than the customer paid',
      'Every refund has a transaction you can check',
      'Works in USDC and EURC',
    ],
    href: '/docs/guides/refunds',
    cta: 'How refunds work',
    Mock: RefundsMock,
  },
  {
    key: 'invoices',
    chip: 'Invoices',
    title: 'Invoices your clients can pay in one click.',
    body: 'Add line items and a due date. Strimz emails your client the invoice with a Pay button that opens checkout, and marks it paid when the money lands.',
    points: [
      'Numbered for you, year by year',
      'Download a PDF from the dashboard',
      'Bill in dollars or euros',
    ],
    href: '/docs/guides/invoices',
    cta: 'How invoices work',
    Mock: InvoicesMock,
  },
  {
    key: 'analytics',
    chip: 'Analytics',
    title: 'Know where revenue is heading.',
    body: 'Monthly recurring revenue, churn, lifetime value and a 90-day forecast, worked out from the payments you actually received.',
    points: [
      'Plans normalised to a monthly figure',
      'Churn over the last 12 months',
      'Forecasts rated by confidence',
    ],
    href: '/docs/dashboard/analytics',
    cta: 'What the reports show',
    Mock: AnalyticsMock,
  },
] as const

function playMock(sheet: Element, key: string) {
  const q = gsap.utils.selector(sheet)
  const tl = gsap.timeline({ defaults: { ease: EASE_OUT }, paused: true })
  tl.from(q('[data-mock]'), { y: 50, rotateX: 10, autoAlpha: 0, duration: 1 })
  if (key === 'subscriptions')
    tl.from(q('[data-cell]'), { scale: 0.6, autoAlpha: 0, stagger: 0.09, duration: 0.5 }, 0.3)
  if (key === 'recovery') {
    tl.from(q('[data-progress]'), { scaleY: 0, duration: 1.4, ease: 'power2.inOut' }, 0.3).from(
      q('[data-step]'),
      { x: 16, autoAlpha: 0, stagger: 0.32, duration: 0.5 },
      0.3,
    )
  }
  if (key === 'refunds')
    tl.from(q('[data-step]'), { y: 14, autoAlpha: 0, stagger: 0.18, duration: 0.5 }, 0.3)
  if (key === 'invoices') {
    tl.from(q('[data-line]'), { autoAlpha: 0, x: -10, stagger: 0.15, duration: 0.4 }, 0.3)
      .from(q('[data-status]'), { autoAlpha: 0, duration: 0.3 }, 1)
      .from(
        q('[data-stamp]'),
        { scale: 2.4, autoAlpha: 0, rotate: -30, duration: 0.5, ease: 'back.out(2)' },
        1,
      )
  }
  if (key === 'analytics') {
    // The line uses a non-scaling stroke, so a dash sized from getTotalLength() stops short; clip it instead.
    tl.fromTo(
      q('[data-line-path]'),
      { clipPath: 'inset(0 100% 0 0)' },
      { clipPath: 'inset(0 0% 0 0)', duration: 1.6, ease: 'power2.inOut' },
      0.3,
    )
    tl.from(q('[data-area]'), { autoAlpha: 0, duration: 1 }, 0.9)
  }
  return tl
}

export function BillingTools() {
  const scope = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        const q = gsap.utils.selector(scope)
        const sheets = q('[data-sheet]')
        sheets.forEach((sheet, i) => {
          const key = SHEETS[i]?.key ?? ''
          const tl = playMock(sheet, key)
          gsap
            .timeline({ scrollTrigger: { trigger: sheet, start: 'top 75%', ...PLAY_ONCE } })
            .add(() => {
              tl.play()
            })
          const next = sheets[i + 1]
          if (!next) return
          const scrub = { trigger: next, start: 'top bottom', end: 'top 15%', scrub: true }
          gsap.to(sheet.querySelector('[data-sheet-inner]'), {
            scale: 0.92,
            ease: 'none',
            scrollTrigger: scrub,
          })
          gsap.fromTo(
            sheet.querySelector('[data-dim]'),
            { opacity: 0 },
            { opacity: 1, ease: 'none', scrollTrigger: scrub },
          )
        })
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <section
      ref={scope}
      id="product"
      aria-labelledby="tools-title"
      className="scroll-mt-20 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <h2
          id="tools-title"
          className="font-sora text-foreground max-w-[16ch] text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px] lg:text-[60px]"
        >
          Everything you need to bill, already built.
        </h2>
        <p className="font-poppins text-muted-foreground mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
          Subscriptions, recovery, refunds, invoices and reporting share one dashboard, one set of
          records and one wallet: yours.
        </p>
      </div>

      <div className="mx-auto mt-14 max-w-[1280px] px-2 sm:px-6">
        {SHEETS.map((s, i) => (
          <article
            key={s.key}
            data-sheet
            aria-labelledby={`sheet-${s.key}`}
            className="mb-6 md:sticky"
            style={{ top: `${88 + i * 14}px` }}
          >
            <div
              data-sheet-inner
              className="border-border bg-muted relative grid origin-top items-center gap-10 overflow-hidden rounded-[32px] border p-6 sm:p-10 md:min-h-[560px] md:grid-cols-2 lg:gap-16 lg:p-14"
            >
              <span
                aria-hidden
                data-dim
                className="pointer-events-none absolute inset-0 z-10 bg-black/10 opacity-0 dark:bg-black/40"
              />
              <div className={cn(i % 2 === 1 && 'md:order-2')}>
                <p className="font-poppins bg-accent/10 text-accent-ink dark:text-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium">
                  <span className="bg-accent size-1.5 rounded-full" />
                  {s.chip}
                </p>
                <h3
                  id={`sheet-${s.key}`}
                  className="font-sora text-foreground mt-5 scroll-mt-28 text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[34px]"
                >
                  {s.title}
                </h3>
                <p className="font-poppins text-muted-foreground mt-4 text-[15px] leading-[1.7] sm:text-base">
                  {s.body}
                </p>
                <ul className="mt-6 space-y-2.5">
                  {s.points.map((p) => (
                    <li
                      key={p}
                      className="font-poppins text-foreground flex items-start gap-2.5 text-[15px]"
                    >
                      <MkIcon icon={checkIcon} className="text-accent mt-0.5 size-5 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  href={s.href}
                  className="font-poppins text-foreground decoration-accent group mt-7 inline-flex items-center gap-1.5 text-[15px] font-medium underline decoration-2 underline-offset-[6px]"
                >
                  {s.cta}
                  <MkIcon
                    icon={arrowIcon}
                    className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                  />
                </Link>
              </div>
              <div
                data-mock
                className={cn('[perspective:1200px]', i % 2 === 1 && 'md:order-1')}
                aria-hidden
              >
                <s.Mock />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
