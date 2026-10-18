'use client'

import Link from 'next/link'
import { useRef } from 'react'
import serverIcon from '@iconify-icons/solar/server-linear'
import codeIcon from '@iconify-icons/solar/code-linear'
import fileIcon from '@iconify-icons/solar/code-file-linear'
import arrowIcon from '@iconify-icons/solar/arrow-right-linear'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@strimz/ui'
import { MkIcon } from '../icon'
import { CopyButton } from '../fx/copy-button'
import dynamic from 'next/dynamic'
import { PlaceholderBlock, PlaceholderLine } from '../fx/placeholder'
import { EASE_OUT, MOTION_OK, gsap, useGSAP, PLAY_ONCE } from '../motion/gsap'

const TypingKeyboard = dynamic(
  () => import('../fx/typing-keyboard').then((m) => m.TypingKeyboard),
  {
    ssr: false,
    loading: () => (
      <div role="status" className="grid h-[300px] place-items-center sm:h-[420px]">
        <span className="sr-only">Loading the keyboard animation</span>
        <PlaceholderBlock className="h-[55%] w-[70%] -rotate-12 skew-x-12 rounded-3xl opacity-60" />
      </div>
    ),
  },
)

const CodeBlock = dynamic(() => import('@/components/shared/code-block').then((m) => m.CodeBlock), {
  ssr: false,
  loading: () => (
    <div role="status" className="space-y-2.5 py-1 opacity-30">
      <span className="sr-only">Loading the code sample</span>
      {['w-2/5', 'w-3/4', 'w-2/3', 'w-1/2', 'w-4/5', 'w-3/5', 'w-1/3'].map((w) => (
        <PlaceholderLine key={w} className={`h-3 ${w}`} />
      ))}
    </div>
  ),
})

const PACKAGES = [
  {
    icon: serverIcon,
    name: '@strimz/sdk',
    note: 'Server SDK for Node and Bun',
    install: 'pnpm add @strimz/sdk',
  },
  {
    icon: codeIcon,
    name: '@strimz/sdk-react',
    note: 'Pay button and embedded checkout',
    install: 'pnpm add @strimz/sdk-react',
  },
  {
    icon: fileIcon,
    name: 'openapi.json',
    note: 'Generate a client in any language',
    install: 'curl https://api.strimz.finance/openapi.json',
  },
] as const

const SAMPLES = [
  {
    value: 'checkout',
    file: 'checkout.tsx',
    language: 'tsx',
    code: `'use client'
import { useRouter } from 'next/navigation'
import { StrimzPayButton } from '@strimz/sdk-react'

export function Checkout({ session }: { session: { id: string } }) {
  const router = useRouter()
  return (
    <StrimzPayButton
      sessionId={session.id}
      onSuccess={(txHash) => router.push(\`/thanks?tx=\${txHash}\`)}
      onError={(err) => console.error(err.message)}
    />
  )
}`,
  },
  {
    value: 'webhooks',
    file: 'webhooks.ts',
    language: 'ts',
    code: `import { verifyWebhookSignature } from '@strimz/sdk'

app.post('/webhooks/strimz', async (req, res) => {
  const payload = req.rawBody.toString()
  const result = await verifyWebhookSignature(
    payload,
    req.headers['strimz-signature'] as string,
    process.env.STRIMZ_WEBHOOK_SECRET!,
  )
  if (!result.valid) return res.status(401).end()
  res.status(200).end()
})`,
  },
] as const

const SCRIPT = `$ pnpm add @strimz/sdk
+ @strimz/sdk
$ node create-session.ts
session created
waiting for payment...
payment.completed
+49.00 USDC to your wallet`

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
        gsap.fromTo(
          '[data-keyboard]',
          { y: 80, rotate: -4 },
          {
            y: -40,
            rotate: 2,
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
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <section
      ref={scope}
      id="developers"
      aria-labelledby="dev-title"
      className="scroll-mt-20 overflow-hidden py-20 sm:py-28"
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
            Use the server SDK, drop the React button into your app, or generate a client from the
            OpenAPI file. Every webhook comes signed, so your systems know it was us.
          </p>
          <ul className="mt-8 space-y-2.5">
            {PACKAGES.map((p) => (
              <li
                key={p.name}
                data-dev-item
                className="border-border bg-card flex items-start gap-3 rounded-2xl border p-3 pr-2 sm:gap-4 sm:p-4 sm:pr-2"
              >
                <span className="bg-accent/10 text-accent grid size-10 shrink-0 place-items-center rounded-xl">
                  <MkIcon icon={p.icon} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground font-mono text-sm font-semibold">{p.name}</p>
                  <p className="font-poppins text-muted-foreground text-[13px]">{p.note}</p>
                  <code className="bg-muted text-muted-foreground mt-2 inline-block max-w-full break-all rounded-lg px-2.5 py-1.5 font-mono text-xs">
                    {p.install}
                  </code>
                </div>
                <CopyButton
                  text={p.install}
                  label={`The ${p.name} install command`}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground"
                />
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

        <div className="relative">
          <div data-keyboard className="relative -mb-4 lg:-mb-6">
            <TypingKeyboard script={SCRIPT} />
          </div>
          <Tabs
            defaultValue="checkout"
            data-dev-item
            className="bg-ink border-border relative overflow-hidden rounded-[24px] border shadow-[0_40px_80px_-40px_rgb(5_0_32/0.6)]"
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
              <TabsList className="h-9 bg-white/5 p-1">
                {SAMPLES.map((s) => (
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
            {SAMPLES.map((s) => (
              <TabsContent
                key={s.value}
                value={s.value}
                className="relative mt-0 max-h-[280px] overflow-auto p-5"
                data-lenis-prevent
              >
                <CopyButton
                  text={s.code}
                  label={`The ${s.file} sample`}
                  className="absolute right-3 top-3 text-white/60 hover:bg-white/10 hover:text-white"
                />
                <CodeBlock code={s.code} language={s.language} tone="dark" />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </section>
  )
}
