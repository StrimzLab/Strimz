'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Code2, Server, Globe2, FileCode2 } from 'lucide-react'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'
import { PaddedLines } from '@/components/shared/padded-lines'
import { CodeBlock } from '@/components/shared/code-block'

const PACKAGES = [
  {
    icon: Server,
    name: '@strimz/sdk',
    runtime: 'Server SDK',
    desc: 'TypeScript client for Node 18+ and Bun. Every response is Zod-validated. Retries are idempotent by default.',
    install: 'pnpm add @strimz/sdk',
  },
  {
    icon: Code2,
    name: '@strimz/sdk-react',
    runtime: 'React SDK',
    desc: 'Drop in <StrimzPayButton/> or our embedded checkout. Read-only hooks for client components. Uses publishable keys, so it’s safe in the browser.',
    install: 'pnpm add @strimz/sdk-react',
  },
  {
    icon: FileCode2,
    name: 'openapi.json',
    runtime: 'OpenAPI 3.1 schema',
    desc: 'Every endpoint described in a machine-readable file. Open it in Postman or Insomnia, or generate a client in any language.',
    install: 'curl https://api.strimz.finance/openapi.json',
  },
] as const

const CHECKOUT_SAMPLE = `'use client'
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
}`

const WEBHOOK_SAMPLE = `import { verifyWebhookSignature } from '@strimz/sdk'

app.post('/webhooks/strimz', async (req, res) => {
  const payload = req.rawBody.toString()
  const result = await verifyWebhookSignature(
    payload,
    req.headers['strimz-signature'] as string,
    process.env.STRIMZ_WEBHOOK_SECRET!,
  )
  if (!result.valid) return res.status(401).end()

  const event = JSON.parse(payload)
  // ... handle event ...
  res.status(200).end()
})`

/**
 * Developer-focused band. Light background to ground the eye between
 * Benefits and PricingTeaser. Three SDK cards stacked at the top, two
 * code samples (browser-side checkout + server-side webhook verify)
 * side-by-side below.
 */
export function Developers() {
  return (
    <>
      <section className="bg-secondary w-full px-4 py-20 md:px-6 lg:py-24">
        <motion.div
          {...inViewOnce}
          variants={stagger(0.05, 0.1)}
          className="mx-auto max-w-[760px] text-center"
        >
          <motion.span
            variants={fadeUp}
            className="font-poppins shadow-sub-card bg-card text-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-[600] ring-1 ring-black/5"
          >
            <span className="bg-accent size-1.5 rounded-full" />
            Developer-first
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="font-sora text-foreground mt-5 text-[32px] font-[700] leading-[40px] md:text-[44px] md:leading-[52px]"
          >
            One API. Three ways to integrate.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="font-poppins text-muted-foreground mt-4 text-base font-[400] leading-[28px]"
          >
            Use the server SDK from Node or Bun. Drop the React SDK into your app for embedded
            checkout. For other languages, generate a client from our OpenAPI schema. Webhooks come
            signed with HMAC-SHA256.
          </motion.p>
        </motion.div>

        {/* Package cards. Stacked vertically so each has full width */}
        <motion.div
          {...inViewOnce}
          variants={stagger(0.05, 0.08)}
          className="mx-auto mt-12 grid max-w-[1100px] gap-3"
        >
          {PACKAGES.map((p) => (
            <motion.div
              key={p.name}
              variants={fadeUp}
              className="shadow-sub-card border-border bg-card hover:border-accent/40 flex flex-col items-start justify-between gap-4 rounded-[16px] border p-5 transition-colors md:flex-row md:items-center md:p-6"
            >
              <div className="flex items-start gap-4 md:items-center">
                <span className="shadow-sub-icon bg-accent/10 text-accent flex size-11 shrink-0 items-center justify-center rounded-[10px]">
                  <p.icon className="size-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-foreground font-mono text-[15px] font-[600]">
                      {p.name}
                    </code>
                    <span className="font-poppins bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-[500]">
                      {p.runtime}
                    </span>
                  </div>
                  <p className="font-poppins text-muted-foreground mt-1 max-w-xl text-[13px] leading-[20px]">
                    {p.desc}
                  </p>
                </div>
              </div>
              <code className="border-border bg-muted text-foreground w-full shrink-0 rounded-[8px] border px-3 py-2 font-mono text-[12px] md:w-auto">
                {p.install}
              </code>
            </motion.div>
          ))}
        </motion.div>

        {/* Two code samples side-by-side */}
        <motion.div
          {...inViewOnce}
          variants={stagger(0.05, 0.08)}
          className="mx-auto mt-10 grid max-w-[1100px] gap-4 lg:grid-cols-2"
        >
          <motion.div variants={fadeUp} className="relative min-w-0">
            <div
              className="from-accent/15 absolute -inset-3 rounded-[20px] bg-gradient-to-br via-transparent to-transparent blur-2xl"
              aria-hidden
            />
            <div className="shadow-sub-card border-border bg-ink relative flex h-full flex-col overflow-hidden rounded-[12px] border">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-rose-500" />
                <span className="size-2.5 rounded-full bg-amber-500" />
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span className="ml-3 font-mono text-[11px] text-white/60">checkout.tsx</span>
                <span className="font-poppins ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                  Client
                </span>
              </div>
              <div className="flex-1 p-5">
                <CodeBlock code={CHECKOUT_SAMPLE} language="tsx" tone="dark" />
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="relative min-w-0">
            <div
              className="from-accent/15 absolute -inset-3 rounded-[20px] bg-gradient-to-br via-transparent to-transparent blur-2xl"
              aria-hidden
            />
            <div className="shadow-sub-card border-border bg-ink relative flex h-full flex-col overflow-hidden rounded-[12px] border">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-rose-500" />
                <span className="size-2.5 rounded-full bg-amber-500" />
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span className="ml-3 font-mono text-[11px] text-white/60">webhooks.ts</span>
                <span className="font-poppins ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                  Server
                </span>
              </div>
              <div className="flex-1 p-5">
                <CodeBlock code={WEBHOOK_SAMPLE} language="ts" tone="dark" />
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* CTA bar */}
        <motion.div
          {...inViewOnce}
          variants={fadeUp}
          className="shadow-sub-card border-border bg-card mx-auto mt-10 flex max-w-[1100px] flex-col items-center justify-between gap-4 rounded-[16px] border p-6 md:flex-row md:p-7"
        >
          <div className="flex items-center gap-3">
            <Globe2 className="text-accent size-5 shrink-0" />
            <p className="font-poppins text-foreground text-sm">
              <span className="font-[600]">Want the full reference?</span>{' '}
              <span className="text-muted-foreground">
                Every endpoint, parameter, and webhook event is documented.
              </span>
            </p>
          </div>
          <Link
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="font-poppins shadow-cta bg-accent inline-flex h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] px-5 text-[14px] font-[600] text-white transition-transform hover:scale-[1.02]"
          >
            <Code2 className="size-4" />
            Open the docs
            <ArrowRight className="size-4" />
          </Link>
        </motion.div>
      </section>
      <PaddedLines />
    </>
  )
}
