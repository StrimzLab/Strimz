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
import { StrimzPayButton } from '@strimz/sdk-react'

export function Checkout({ session }) {
  return (
    <StrimzPayButton
      sessionId={session.id}
      onSuccess={(tx) => router.push('/thanks')}
      onError={(err) => toast.error(err.message)}
    />
  )
}`

const WEBHOOK_SAMPLE = `import { verifyWebhookSignature } from '@strimz/sdk'

app.post('/webhooks/strimz', (req, res) => {
  const ok = verifyWebhookSignature({
    secret: process.env.STRIMZ_WEBHOOK_SECRET,
    body: req.rawBody,
    signatureHeader: req.headers['strimz-signature'],
  })
  if (!ok) return res.status(401).end()

  const event = JSON.parse(req.rawBody.toString())
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
      <section className="w-full bg-[#F3F4F6] px-4 py-20 md:px-6 lg:py-24">
        <motion.div
          {...inViewOnce}
          variants={stagger(0.05, 0.1)}
          className="mx-auto max-w-[760px] text-center"
        >
          <motion.span
            variants={fadeUp}
            className="font-poppins shadow-sub-card inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-[600] text-[#050020] ring-1 ring-black/5"
          >
            <span className="size-1.5 rounded-full bg-[#02C76A]" />
            Developer-first
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="font-sora mt-5 text-[32px] font-[700] leading-[40px] text-[#050020] md:text-[44px] md:leading-[52px]"
          >
            One API. Three ways to integrate.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="font-poppins mt-4 text-base font-[400] leading-[28px] text-[#58556A]"
          >
            Use the server SDK from Node or Bun. Drop the React SDK into your app for embedded
            checkout. For other languages, generate a client from our OpenAPI schema. Webhooks come
            signed with HMAC-SHA256.
          </motion.p>
        </motion.div>

        {/* Package cards — stacked vertically so each has full width */}
        <motion.div
          {...inViewOnce}
          variants={stagger(0.05, 0.08)}
          className="mx-auto mt-12 grid max-w-[1100px] gap-3"
        >
          {PACKAGES.map((p) => (
            <motion.div
              key={p.name}
              variants={fadeUp}
              className="shadow-sub-card flex flex-col items-start justify-between gap-4 rounded-[16px] border border-[#E5E7EB] bg-white p-5 transition-colors hover:border-[#02C76A]/40 md:flex-row md:items-center md:p-6"
            >
              <div className="flex items-start gap-4 md:items-center">
                <span className="shadow-sub-icon flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-[#02C76A]/10 text-[#02C76A]">
                  <p.icon className="size-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-[15px] font-[600] text-[#050020]">
                      {p.name}
                    </code>
                    <span className="font-poppins rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-[500] text-[#58556A]">
                      {p.runtime}
                    </span>
                  </div>
                  <p className="font-poppins mt-1 max-w-xl text-[13px] leading-[20px] text-[#58556A]">
                    {p.desc}
                  </p>
                </div>
              </div>
              <code className="w-full shrink-0 rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 font-mono text-[12px] text-[#050020] md:w-auto">
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
              className="absolute -inset-3 rounded-[20px] bg-gradient-to-br from-[#02C76A]/15 via-transparent to-transparent blur-2xl"
              aria-hidden
            />
            <div className="shadow-sub-card relative flex h-full flex-col overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-[#050020]">
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
              className="absolute -inset-3 rounded-[20px] bg-gradient-to-br from-[#02C76A]/15 via-transparent to-transparent blur-2xl"
              aria-hidden
            />
            <div className="shadow-sub-card relative flex h-full flex-col overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-[#050020]">
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
          className="shadow-sub-card mx-auto mt-10 flex max-w-[1100px] flex-col items-center justify-between gap-4 rounded-[16px] border border-[#E5E7EB] bg-white p-6 md:flex-row md:p-7"
        >
          <div className="flex items-center gap-3">
            <Globe2 className="size-5 shrink-0 text-[#02C76A]" />
            <p className="font-poppins text-sm text-[#050020]">
              <span className="font-[600]">Want the full reference?</span>{' '}
              <span className="text-[#58556A]">
                Every endpoint, parameter, and webhook event is documented.
              </span>
            </p>
          </div>
          <Link
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="font-poppins shadow-cta inline-flex h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] bg-[#02C76A] px-5 text-[14px] font-[600] text-white transition-transform hover:scale-[1.02]"
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
