'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Mail, Repeat, Wallet, X, Zap } from 'lucide-react'
import { cn } from '@strimz/ui'

/**
 * Animated dashboard preview shown in the marketing hero.
 *
 * Three scenes cycle, each one its own time-driven state machine. A
 * step counter advances on a timer and individual elements appear,
 * morph, or exit on cue. Framer Motion handles the choreography.
 *
 *   Scene 1. Subscription billing (~7s). 7-month history fills cell-by-cell
 *   Scene 2. One-time payment confirming on-chain (~6s). Pending → confirming → confirmed
 *   Scene 3. Failed charge → recovery (~7s). Timeline events stagger in
 *
 * Browser-chrome shell + halo stay mounted; only the inner content +
 * URL + floating chips swap. Pauses while the tab is hidden, and
 * respects `prefers-reduced-motion` (each scene jumps to its final
 * frame and the rotator stops).
 */
const SCENE_DURATIONS = [7000, 6000, 7000] as const
const URLS = [
  'app.strimz.finance/app/subscriptions',
  'app.strimz.finance/app/payment-sessions',
  'app.strimz.finance/app/subscriptions',
] as const

export function DashboardPreview() {
  const reducedMotion = useReducedMotion() ?? false
  const [sceneIndex, setSceneIndex] = useState(0)
  const [tabVisible, setTabVisible] = useState(true)

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (reducedMotion || !tabVisible) return
    const t = setTimeout(
      () => setSceneIndex((i) => (i + 1) % 3),
      SCENE_DURATIONS[sceneIndex] ?? SCENE_DURATIONS[0],
    )
    return () => clearTimeout(t)
  }, [sceneIndex, tabVisible, reducedMotion])

  return (
    <div className="relative w-full max-w-[560px]">
      <div
        aria-hidden
        className="from-accent/25 via-accent/5 absolute -inset-6 rounded-[28px] bg-gradient-to-br to-transparent blur-3xl"
      />

      <div className="border-border bg-card relative overflow-hidden rounded-[14px] border shadow-[0_30px_60px_-15px_rgba(5,0,32,0.18)]">
        <ChromeBar urlIndex={sceneIndex} />

        {/* Fixed min-height keeps the card from jumping between scenes */}
        <div className="relative min-h-[400px]">
          <AnimatePresence mode="wait">
            {sceneIndex === 0 ? (
              <SubscriptionScene key="scene-sub" reducedMotion={reducedMotion} />
            ) : sceneIndex === 1 ? (
              <OneShotScene key="scene-oneshot" reducedMotion={reducedMotion} />
            ) : (
              <RecoveryScene key="scene-recovery" reducedMotion={reducedMotion} />
            )}
          </AnimatePresence>
        </div>
      </div>

      <FloatingChips sceneIndex={sceneIndex} />
    </div>
  )
}

/* ─────────── Browser chrome ─────────── */

function ChromeBar({ urlIndex }: { urlIndex: number }) {
  return (
    <div className="border-border bg-muted flex items-center gap-2 border-b px-3 py-2.5 sm:px-4 sm:py-3">
      <span className="bg-window-close size-2.5 rounded-full" />
      <span className="bg-window-minimize size-2.5 rounded-full" />
      <span className="bg-window-zoom size-2.5 rounded-full" />
      <div className="bg-card ml-2 flex flex-1 items-center gap-1.5 truncate rounded-md px-3 py-1 ring-1 ring-black/5 sm:ml-3">
        <span className="bg-accent size-1 shrink-0 rounded-full" />
        <AnimatePresence mode="wait">
          <motion.span
            key={URLS[urlIndex]}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="text-muted-foreground truncate font-mono text-[10px] sm:text-[11px]"
          >
            {URLS[urlIndex]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─────────── Scene 1: subscription billing ─────────── */

function SubscriptionScene({ reducedMotion }: { reducedMotion: boolean }) {
  const finalStep = 13
  const [step, setStep] = useState(reducedMotion ? finalStep : 0)

  useEffect(() => {
    if (reducedMotion) return
    const beats = [200, 500, 800, 1100, 1400, 1700, 2000, 2300, 2600, 2900, 3200, 3700, 4200]
    const timers = beats.map((delay, i) => setTimeout(() => setStep(i + 1), delay))
    return () => timers.forEach(clearTimeout)
  }, [reducedMotion])

  const charges = ['May 2', 'Apr 2', 'Mar 2', 'Feb 2', 'Jan 2', 'Dec 2', 'Nov 2']

  return (
    <SceneShell>
      <SceneHeader>
        <Repeat className="text-accent size-4" />
        <SceneTitle>Subscriptions</SceneTitle>
        <Pill tone="positive">12 active</Pill>
      </SceneHeader>

      <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
        <div className="border-accent/30 from-accent/5 to-card rounded-[10px] border bg-gradient-to-br p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Reveal show={step >= 1}>
                <code className="text-muted-foreground font-mono text-[10px] sm:text-[11px]">
                  0x3f4a…a2d1
                </code>
              </Reveal>
              <Reveal show={step >= 2}>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-sora text-foreground text-[15px] font-[700] sm:text-[16px]">
                    Pro
                  </span>
                  <span className="text-foreground font-mono text-[13px] font-[500] sm:text-[14px]">
                    $20.00 USDC
                  </span>
                  <span className="font-poppins text-muted-foreground text-[10px] sm:text-[11px]">
                    /month
                  </span>
                </div>
              </Reveal>
            </div>
            <Reveal show={step >= 3}>
              <PulsePill>active</PulsePill>
            </Reveal>
          </div>

          <AnimatePresence>
            {step >= 13 ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-accent/15 mt-3 flex items-center justify-between border-t pt-3"
              >
                <span className="font-poppins text-muted-foreground text-[10px] sm:text-[11px]">
                  Next charge
                </span>
                <CountdownClock />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {step >= 4 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="border-border bg-muted rounded-[10px] border p-3.5 sm:p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-poppins text-muted-foreground text-[10px] font-[600] uppercase tracking-wider sm:text-[11px]">
                Last 7 charges
              </span>
              {step >= 11 ? (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-poppins text-accent text-[10px] sm:text-[11px]"
                >
                  all confirmed
                </motion.span>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 sm:gap-1.5">
              {charges.map((label, i) => (
                <ChargeCell key={label} label={label} show={step >= 5 + i} />
              ))}
            </div>
            {step >= 12 ? (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-poppins text-muted-foreground mt-3 text-[10px] sm:text-[11px]"
              >
                Customer signed <span className="text-foreground font-[600]">once on April 2</span>
                {' · '}charged <span className="text-accent font-[600]">7 times</span>
              </motion.p>
            ) : null}
          </motion.div>
        ) : null}
      </div>
    </SceneShell>
  )
}

function ChargeCell({ label, show }: { label: string; show: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={show ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="bg-card ring-border flex flex-col items-center gap-1 rounded-md p-1.5 ring-1 sm:p-2"
    >
      <motion.span
        initial={{ scale: 0 }}
        animate={show ? { scale: 1 } : { scale: 0 }}
        transition={{ delay: 0.08, type: 'spring', stiffness: 350, damping: 18 }}
      >
        <Check className="text-accent size-3" strokeWidth={3} />
      </motion.span>
      <span className="text-muted-foreground font-mono text-[8px] sm:text-[9px]">{label}</span>
    </motion.div>
  )
}

function CountdownClock() {
  const start = 2 * 86400 + 4 * 3600 + 12 * 60
  const [seconds, setSeconds] = useState(start)

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)

  return (
    <span className="text-foreground font-mono text-[10px] font-[600] tabular-nums sm:text-[11px]">
      in {days}d · {hours}h · {mins}m
    </span>
  )
}

/* ─────────── Scene 2: one-time payment ─────────── */

function OneShotScene({ reducedMotion }: { reducedMotion: boolean }) {
  const finalStep = 5
  const [step, setStep] = useState(reducedMotion ? finalStep : 0)

  useEffect(() => {
    if (reducedMotion) return
    const beats = [300, 600, 1200, 2400, 2800]
    const timers = beats.map((delay, i) => setTimeout(() => setStep(i + 1), delay))
    return () => timers.forEach(clearTimeout)
  }, [reducedMotion])

  return (
    <SceneShell>
      <SceneHeader>
        <Zap className="text-accent size-4" />
        <SceneTitle>Payment sessions</SceneTitle>
        <AnimatePresence mode="wait">
          {step >= 4 ? (
            <motion.span
              key="confirmed-badge"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Pill tone="positive">1 confirmed</Pill>
            </motion.span>
          ) : step >= 3 ? (
            <motion.span
              key="confirming-badge"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Pill tone="info">1 confirming</Pill>
            </motion.span>
          ) : step >= 1 ? (
            <motion.span
              key="pending-badge"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Pill tone="warning">1 pending</Pill>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </SceneHeader>

      <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
        {step >= 1 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn(
              'bg-card rounded-[10px] border p-3.5 transition-colors sm:p-4',
              step >= 4 ? 'border-accent/30' : 'border-border',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <code className="text-muted-foreground font-mono text-[10px] sm:text-[11px]">
                  0xa9f3…7c12
                </code>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-sora text-foreground text-[14px] font-[700] sm:text-[15px]">
                    Pro plan, August
                  </span>
                  <span className="text-foreground font-mono text-[13px] font-[500] sm:text-[14px]">
                    $50.00 USDC
                  </span>
                </div>
              </div>
              <SessionStatusPill step={step} />
            </div>

            <AnimatePresence mode="wait">
              {step === 3 ? (
                <BlockTicker key="ticker" />
              ) : step >= 4 ? (
                <motion.div
                  key="settled"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-accent/15 mt-3 flex items-center justify-between border-t pt-3"
                >
                  <span className="font-poppins text-muted-foreground text-[10px] sm:text-[11px]">
                    Settled in
                  </span>
                  <span className="text-accent font-mono text-[10px] font-[600] sm:text-[11px]">
                    ~13 seconds
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}

        {step >= 5 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="border-accent/30 bg-accent/5 rounded-[10px] border p-3.5 sm:p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wallet className="text-accent size-4" />
                <span className="font-poppins text-foreground text-[11px] font-[500] sm:text-[12px]">
                  Payout to your wallet
                </span>
              </div>
              <span className="text-accent font-mono text-[12px] font-[700] sm:text-[13px]">
                +$49.75 USDC
              </span>
            </div>
            <div className="border-accent/15 mt-2 flex items-center justify-between border-t pt-2">
              <span className="font-poppins text-muted-foreground text-[9px] sm:text-[10px]">
                Strimz fee (0.5%)
              </span>
              <span className="text-muted-foreground font-mono text-[9px] sm:text-[10px]">
                0.25 USDC
              </span>
            </div>
          </motion.div>
        ) : null}
      </div>
    </SceneShell>
  )
}

function SessionStatusPill({ step }: { step: number }) {
  if (step < 2) return null
  if (step === 2) {
    return (
      <motion.span
        key="pending"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        className="font-poppins inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-[500] text-amber-700 sm:text-[11px]"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
        pending
      </motion.span>
    )
  }
  if (step === 3) {
    return (
      <motion.span
        key="confirming"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        className="font-poppins inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-[10px] font-[500] text-sky-700 sm:text-[11px]"
      >
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500/70" />
          <span className="relative inline-flex size-1.5 rounded-full bg-sky-500" />
        </span>
        confirming
      </motion.span>
    )
  }
  return (
    <motion.span
      key="confirmed"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 15 }}
      className="font-poppins bg-accent/10 text-accent inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-[500] sm:text-[11px]"
    >
      <Check className="size-3" strokeWidth={3} />
      confirmed
    </motion.span>
  )
}

function BlockTicker() {
  const [block, setBlock] = useState(18_402_001)
  useEffect(() => {
    const id = setInterval(() => setBlock((b) => b + 1), 350)
    return () => clearInterval(id)
  }, [])
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mt-3 flex items-center justify-between border-t border-sky-500/15 pt-3"
    >
      <span className="font-poppins text-muted-foreground text-[10px] sm:text-[11px]">Block</span>
      <span className="font-mono text-[10px] font-[600] tabular-nums text-sky-700 sm:text-[11px]">
        #{block.toLocaleString()}
      </span>
    </motion.div>
  )
}

/* ─────────── Scene 3: failed charge → recovery ─────────── */

function RecoveryScene({ reducedMotion }: { reducedMotion: boolean }) {
  const finalStep = 7
  const [step, setStep] = useState(reducedMotion ? finalStep : 0)

  useEffect(() => {
    if (reducedMotion) return
    const beats = [300, 800, 1500, 2500, 3500, 4500, 5000]
    const timers = beats.map((delay, i) => setTimeout(() => setStep(i + 1), delay))
    return () => timers.forEach(clearTimeout)
  }, [reducedMotion])

  const isAtRisk = step >= 2 && step < 7
  const isResolved = step >= 7

  return (
    <SceneShell>
      <SceneHeader>
        <Repeat className="text-accent size-4" />
        <SceneTitle>Subscriptions</SceneTitle>
        <AnimatePresence mode="wait">
          {isAtRisk ? (
            <motion.span
              key="atrisk"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Pill tone="warning">1 at-risk</Pill>
            </motion.span>
          ) : (
            <motion.span
              key="active"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Pill tone="positive">12 active</Pill>
            </motion.span>
          )}
        </AnimatePresence>
      </SceneHeader>

      <div className="space-y-3 p-4 sm:p-5">
        {step >= 1 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'rounded-[10px] border p-3.5 transition-colors sm:p-4',
              isAtRisk ? 'border-amber-500/30 bg-amber-500/5' : 'border-accent/30 bg-accent/5',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <code className="text-muted-foreground font-mono text-[10px] sm:text-[11px]">
                  0x77b2…cf08
                </code>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-sora text-foreground text-[14px] font-[700] sm:text-[15px]">
                    Team plan
                  </span>
                  <span className="text-foreground font-mono text-[13px] font-[500] sm:text-[14px]">
                    $80.00 USDC
                  </span>
                  <span className="font-poppins text-muted-foreground text-[10px] sm:text-[11px]">
                    /month
                  </span>
                </div>
              </div>
              <RecoveryStatusPill atRisk={isAtRisk} resolved={isResolved} />
            </div>
          </motion.div>
        ) : null}

        {step >= 3 ? (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
            className="border-border bg-muted rounded-[10px] border p-3.5 sm:p-4"
          >
            <div className="font-poppins text-muted-foreground text-[10px] font-[600] uppercase tracking-wider sm:text-[11px]">
              Recovery timeline
            </div>
            <div className="mt-3 space-y-2">
              <TimelineRow
                show={step >= 3}
                icon={<X className="size-3" />}
                time="13:42"
                label="Charge failed (insufficient funds)"
                tone="danger"
              />
              <TimelineRow
                show={step >= 4}
                icon={<Mail className="size-3" />}
                time="13:43"
                label="Recovery email sent"
                tone="info"
              />
              <TimelineRow
                show={step >= 5}
                icon={<Wallet className="size-3" />}
                time="13:51"
                label="Customer topped up wallet"
                tone="info"
              />
              <TimelineRow
                show={step >= 6}
                icon={<Check className="size-3" strokeWidth={3} />}
                time="13:52"
                label="Retry succeeded"
                tone="success"
              />
            </div>
          </motion.div>
        ) : null}
      </div>
    </SceneShell>
  )
}

function RecoveryStatusPill({ atRisk, resolved }: { atRisk: boolean; resolved: boolean }) {
  if (atRisk && !resolved) {
    return (
      <motion.span
        initial={{ scale: 0.85 }}
        animate={{ scale: 1 }}
        className="font-poppins inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-[500] text-amber-700 sm:text-[11px]"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
        at_risk
      </motion.span>
    )
  }
  return <PulsePill>active</PulsePill>
}

function TimelineRow({
  show,
  icon,
  time,
  label,
  tone,
}: {
  show: boolean
  icon: ReactNode
  time: string
  label: string
  tone: 'danger' | 'info' | 'success'
}) {
  const tones = {
    danger: 'bg-rose-500/10 text-rose-700',
    info: 'bg-sky-500/10 text-sky-700',
    success: 'bg-accent/10 text-accent',
  } as const
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={show ? { opacity: 1, x: 0 } : { opacity: 0, x: 8 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2.5"
    >
      <span className={cn('flex size-6 items-center justify-center rounded-full', tones[tone])}>
        {icon}
      </span>
      <span className="text-muted-foreground font-mono text-[9px] sm:text-[10px]">{time}</span>
      <span className="font-poppins text-foreground text-[10px] sm:text-[11px]">{label}</span>
    </motion.div>
  )
}

/* ─────────── Floating chips that morph per scene ─────────── */

function FloatingChips({ sceneIndex }: { sceneIndex: number }) {
  const top = [
    { event: 'subscription.charged', latency: '· 84ms' },
    { event: 'payment.completed', latency: '· 12s after submit' },
    { event: 'subscription.charged', latency: '· recovered' },
  ] as const
  const bottom = [
    { amount: '+$20.00 USDC' },
    { amount: '+$49.75 USDC' },
    { amount: '+$80.00 USDC' },
  ] as const
  const topScene = top[sceneIndex] ?? top[0]
  const bottomScene = bottom[sceneIndex] ?? bottom[0]
  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={`top-${sceneIndex}`}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-card absolute -top-4 right-2 hidden items-center gap-2 rounded-full px-3 py-2 shadow-[0_15px_30px_-10px_rgba(5,0,32,0.25)] ring-1 ring-black/5 sm:flex md:right-4"
        >
          <span className="relative flex size-2">
            <span className="bg-accent/60 absolute inline-flex h-full w-full animate-ping rounded-full" />
            <span className="bg-accent relative inline-flex size-2 rounded-full" />
          </span>
          <code className="text-foreground font-mono text-[10px] font-[500] md:text-[11px]">
            {topScene.event}
          </code>
          <span className="font-poppins text-muted-foreground text-[9px] md:text-[10px]">
            {topScene.latency}
          </span>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={`bot-${sceneIndex}`}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 8, opacity: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="bg-ink absolute -bottom-4 left-2 hidden items-center gap-2 rounded-full px-3 py-2 shadow-[0_15px_30px_-10px_rgba(5,0,32,0.4)] sm:flex md:left-4"
        >
          <Wallet className="text-accent size-3.5" />
          <span className="font-mono text-[10px] font-[500] text-white md:text-[11px]">
            {bottomScene.amount}
          </span>
          <span className="font-poppins text-[9px] text-white/60 md:text-[10px]">
            → payout wallet
          </span>
        </motion.div>
      </AnimatePresence>
    </>
  )
}

/* ─────────── Shared little pieces ─────────── */

function SceneShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0"
    >
      {children}
    </motion.div>
  )
}

function SceneHeader({ children }: { children: ReactNode }) {
  return (
    <div className="border-border flex items-center justify-between border-b px-4 py-3 sm:px-5">
      <div className="flex items-center gap-2">{children}</div>
      <span className="font-poppins text-muted-foreground hidden text-[11px] sm:inline">Live</span>
    </div>
  )
}

function SceneTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-sora text-foreground text-[13px] font-[600] sm:text-[14px]">{children}</h3>
  )
}

function Pill({
  children,
  tone = 'positive',
}: {
  children: ReactNode
  tone?: 'positive' | 'info' | 'warning'
}) {
  const tones = {
    positive: 'bg-accent/10 text-accent',
    info: 'bg-sky-500/10 text-sky-700',
    warning: 'bg-amber-500/10 text-amber-700',
  } as const
  return (
    <span
      className={cn(
        'font-poppins rounded-full px-2 py-0.5 text-[10px] font-[500] sm:text-[11px]',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

function PulsePill({ children }: { children: ReactNode }) {
  return (
    <span className="font-poppins bg-accent/10 text-accent inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-[500] sm:text-[11px]">
      <span className="relative flex size-1.5">
        <span className="bg-accent/70 absolute inline-flex h-full w-full animate-ping rounded-full" />
        <span className="bg-accent relative inline-flex size-1.5 rounded-full" />
      </span>
      {children}
    </span>
  )
}

function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}
