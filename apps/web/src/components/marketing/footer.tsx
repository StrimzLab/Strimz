'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { FaGithub, FaLinkedin, FaXTwitter } from 'react-icons/fa6'
import art1 from '@/../public/art/1.svg'
import art2 from '@/../public/art/2.svg'
import dynamic from 'next/dynamic'
import externalIcon from '@iconify-icons/solar/arrow-right-up-linear'
import { Logo } from '@/components/shared/logo'
import { MkIcon } from './icon'
import { PlaceholderLine } from './fx/placeholder'
import { MOTION_OK, gsap, useGSAP, PLAY_ONCE } from './motion/gsap'

const AsciiStage = dynamic(() => import('./fx/ascii-stage').then((m) => m.AsciiStage), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="mt-12 flex h-40 items-center justify-between px-10 opacity-20 lg:mt-4"
    >
      <span className="sr-only">Loading the footer artwork</span>
      <PlaceholderLine className="h-24 w-[30%] rounded-full" />
      <PlaceholderLine className="h-24 w-[30%] rounded-full" />
    </div>
  ),
})

const COLUMNS = [
  {
    label: 'Product',
    links: [
      { href: '/pricing', label: 'Pricing' },
      { href: '/use-cases', label: 'Use cases' },
      { href: '/docs', label: 'Documentation' },
      { href: '/docs/api/overview', label: 'API reference' },
    ],
  },
  {
    label: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: 'https://github.com/StrimzLab/strimz', label: 'GitHub', external: true },
    ],
  },
  {
    label: 'Legal',
    links: [
      { href: '/legal/terms', label: 'Terms of Service' },
      { href: '/legal/privacy', label: 'Privacy Policy' },
      { href: '/legal/acceptable-use', label: 'Acceptable use' },
    ],
  },
] as const satisfies readonly {
  label: string
  links: readonly { href: string; label: string; external?: boolean }[]
}[]

const SOCIAL = [
  { href: 'https://x.com/Strimz_HQ', label: 'Strimz on X', Icon: FaXTwitter },
  {
    href: 'https://www.linkedin.com/company/strimzhq/',
    label: 'Strimz on LinkedIn',
    Icon: FaLinkedin,
  },
  { href: 'https://github.com/StrimzLab/strimz', label: 'Strimz on GitHub', Icon: FaGithub },
] as const

const WORDMARK = 'Strimz'

export function MarketingFooter() {
  const scope = useRef<HTMLElement>(null)
  const year = new Date().getFullYear()

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap.from('[data-rule]', {
          scaleX: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: scope.current,
            start: 'top bottom',
            end: 'top 55%',
            scrub: true,
          },
        })
        gsap.from('[data-col]', {
          y: 24,
          autoAlpha: 0,
          duration: 0.9,
          stagger: 0.07,
          ease: 'power3.out',
          scrollTrigger: { trigger: scope.current, start: 'top 85%', ...PLAY_ONCE },
        })
        gsap.from('[data-mark-char]', {
          yPercent: 115,
          duration: 1.1,
          ease: 'power3.out',
          stagger: { each: 0.05, from: 'center' },
          scrollTrigger: {
            trigger: '[data-mark]',
            start: 'top 95%',
            toggleActions: 'play none none reverse',
          },
        })
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <footer ref={scope} className="relative mt-28 overflow-hidden sm:mt-36 lg:mt-44">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <div aria-hidden className="relative h-px">
          <div className="bg-border absolute inset-0" />
          <div
            data-rule
            className="via-accent absolute inset-0 origin-left bg-gradient-to-r from-transparent to-transparent"
          />
        </div>

        <div className="flex flex-col justify-between gap-12 pt-14 lg:flex-row lg:pt-20">
          <div data-col className="max-w-xs">
            <Logo className="lg:w-[126.98px]" />
            <p className="font-poppins text-muted-foreground mt-5 text-sm leading-relaxed">
              Stablecoin billing for businesses. One-time payments, subscriptions and invoices,
              settled in USDC and EURC.
            </p>
            <ul className="mt-6 flex items-center gap-2">
              {SOCIAL.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="border-border text-muted-foreground hover:border-accent hover:text-foreground focus-visible:ring-accent grid size-10 place-items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
                  >
                    <Icon className="size-[18px]" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid w-full max-w-2xl grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <nav key={col.label} aria-label={col.label} data-col>
                <p className="font-sora text-foreground mb-4 text-sm font-semibold">{col.label}</p>
                <ul className="font-poppins text-muted-foreground space-y-3 text-sm">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        {...('external' in l && l.external
                          ? { target: '_blank', rel: 'noreferrer' }
                          : {})}
                        className="from-accent to-accent hover:text-foreground focus-visible:ring-accent group inline-flex items-center gap-1 rounded-sm bg-gradient-to-r bg-[length:0%_1.5px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size,color] duration-300 hover:bg-[length:100%_1.5px] focus-visible:outline-none focus-visible:ring-2"
                      >
                        {l.label}
                        {'external' in l && l.external ? (
                          <MkIcon
                            icon={externalIcon}
                            className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          />
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </div>

      <AsciiStage
        left={art1.src}
        right={art2.src}
        className="mt-12 overflow-hidden px-3 sm:px-6 lg:mt-4"
      />

      <div className="relative mx-auto max-w-[1280px] px-5 sm:px-10">
        <p
          data-mark
          aria-label={WORDMARK}
          className="font-sora -mb-[0.12em] overflow-hidden pb-[0.12em] text-center text-[26vw] font-semibold leading-[0.82] tracking-[-0.06em] sm:text-[21vw] xl:text-[17rem]"
        >
          {[...WORDMARK].map((ch, i) => (
            <span
              key={i}
              data-mark-char
              aria-hidden
              className="from-foreground to-foreground/15 inline-block bg-gradient-to-b bg-clip-text text-transparent"
            >
              {ch}
            </span>
          ))}
        </p>

        <div className="font-poppins text-muted-foreground border-border flex flex-col items-center justify-between gap-4 border-t pb-24 pt-6 text-sm sm:flex-row lg:pb-6">
          <p>Built by the Strimz team</p>
          <p>© {year} Strimz. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
