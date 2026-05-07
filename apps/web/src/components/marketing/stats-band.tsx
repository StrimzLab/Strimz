'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'

type Stat = {
  /** Final number to count up to. */
  value: number
  /** Optional prefix (e.g. `$`). */
  prefix?: string
  /** Optional suffix (e.g. `M+`, `s`, `%`). */
  suffix?: string
  /** Decimals to render. */
  decimals?: number
  label: string
}

const STATS: readonly Stat[] = [
  { prefix: '$', value: 48, suffix: 'M+', label: 'Settled volume' },
  { value: 12_400, label: 'Transactions' },
  { value: 13, suffix: 's', label: 'Median settlement' },
  { value: 99.97, suffix: '%', label: 'Webhook success', decimals: 2 },
]

/**
 * Headline stats band. Animated counters tick from 0 → target the
 * first time the band scrolls into view. Honors prefers-reduced-motion
 * by snapping straight to the final number.
 */
export function StatsBand() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      ref={ref}
      className="relative w-full overflow-hidden bg-[#050020] px-4 py-16 md:px-6 lg:py-20"
    >
      {/* Soft accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-20 mx-auto h-[280px] max-w-3xl rounded-full bg-[#02C76A]/15 blur-3xl"
      />

      <div className="relative mx-auto max-w-[1200px]">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.5 }}
          className="font-poppins text-center text-[12px] font-[500] uppercase tracking-[0.22em] text-white/60"
        >
          Built for production scale
        </motion.p>

        <div className="mt-10 grid grid-cols-2 gap-y-8 sm:grid-cols-4 sm:gap-x-6 lg:gap-x-10">
          {STATS.map((s, i) => (
            <Counter key={s.label} stat={s} startNow={inView} delay={i * 0.08} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Counter({ stat, startNow, delay }: { stat: Stat; startNow: boolean; delay: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!startNow) return
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setDisplay(stat.value)
      return
    }

    const duration = 1400
    const start = performance.now() + delay * 1000
    let raf = 0
    const tick = (now: number) => {
      const elapsed = Math.max(0, now - start)
      const t = Math.min(1, elapsed / duration)
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(stat.value * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [startNow, stat.value, delay])

  const decimals = stat.decimals ?? 0
  const formatted =
    decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString('en-US')

  return (
    <div className="text-center sm:text-left">
      <div className="font-sora text-[40px] font-[700] leading-none tracking-[-0.02em] text-white sm:text-[44px] lg:text-[52px]">
        {stat.prefix}
        {formatted}
        {stat.suffix}
      </div>
      <div className="font-poppins mt-2 text-[12px] font-[400] uppercase tracking-[0.18em] text-white/60 sm:text-[13px]">
        {stat.label}
      </div>
    </div>
  )
}
