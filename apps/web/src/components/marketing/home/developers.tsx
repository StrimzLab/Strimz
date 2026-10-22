'use client'

import Link from 'next/link'
import { useRef } from 'react'
import arrowIcon from '@iconify-icons/solar/arrow-right-linear'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@strimz/ui'
import { MkIcon } from '../icon'
import { CopyButton } from '../fx/copy-button'
import dynamic from 'next/dynamic'
import { PlaceholderLine } from '../fx/placeholder'
import { EASE_OUT, MOTION_OK, gsap, useGSAP, PLAY_ONCE } from '../motion/gsap'
import { CODE_TABS, DEV_LINKS } from './developers-data'

const CodeBlock = dynamic(() => import('@/components/shared/code-block').then((m) => m.CodeBlock), {
  ssr: false,
  loading: () => (
    <div role="status" className="space-y-2.5 py-1 opacity-30">
      <span className="sr-only">Loading the code example</span>
      {['w-2/5', 'w-3/4', 'w-2/3', 'w-1/2', 'w-4/5', 'w-3/5'].map((w) => (
        <PlaceholderLine key={w} className={`h-3 ${w}`} />
      ))}
    </div>
  ),
})

export function Developers() {
  const scope = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap.from('[data-dev-item]', {
          y: 40,
          autoAlpha: 0,
          duration: 1,
          stagger: 0.1,
          ease: EASE_OUT,
          scrollTrigger: { trigger: scope.current, start: 'top 70%', ...PLAY_ONCE },
        })
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <section
      ref={scope}
      id="developers"
      aria-labelledby="dev-title"
      className="scroll-mt-20 overflow-hidden py-20 sm:py-24"
    >
      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] items-center gap-10 px-5 sm:px-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <p
            data-dev-item
            className="font-poppins bg-card text-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ring-1 ring-black/5 dark:ring-white/10"
          >
            <span className="bg-accent size-1.5 rounded-full" />
            For your developer
          </p>
          <h2
            id="dev-title"
            data-dev-item
            className="font-sora text-foreground mt-5 text-balance text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px] lg:text-[52px]"
          >
            One API. Three ways in.
          </h2>
          <p
            data-dev-item
            className="font-poppins text-muted-foreground mt-5 max-w-lg text-base leading-relaxed sm:text-lg"
          >
            Add a pay button to your app, call the server SDK, or generate a client from the OpenAPI
            file. Every webhook is signed.
          </p>
          <ul data-dev-item className="mt-6 flex flex-wrap gap-2">
            {DEV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="font-poppins border-border text-foreground hover:border-accent focus-visible:ring-accent/50 inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            data-dev-item
            href="/docs"
            className="font-poppins text-foreground decoration-accent group mt-8 inline-flex items-center gap-1.5 text-[15px] font-medium underline decoration-2 underline-offset-[6px]"
          >
            Read the docs
            <MkIcon
              icon={arrowIcon}
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>
        </div>

        <Tabs
          defaultValue="checkout"
          data-dev-item
          className="bg-ink border-border relative min-w-0 overflow-hidden rounded-[24px] border shadow-[0_40px_80px_-40px_rgb(5_0_32/0.6)]"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <TabsList className="h-9 bg-white/5 p-1">
              {CODE_TABS.map((s) => (
                <TabsTrigger
                  key={s.value}
                  value={s.value}
                  className="font-mono text-xs text-white/60 data-[state=active]:bg-white/10 data-[state=active]:text-white"
                >
                  {s.file}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {CODE_TABS.map((s) => (
            <TabsContent key={s.value} value={s.value} className="relative mt-0 p-5 pr-10">
              <CopyButton
                text={s.code}
                label={`The ${s.file} example`}
                className="absolute right-3 top-3 text-white/60 hover:bg-white/10 hover:text-white"
              />
              <CodeBlock code={s.code} language={s.language} tone="dark" />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}
