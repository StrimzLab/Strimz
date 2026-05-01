'use client'

import { motion } from 'framer-motion'
import { Glyph } from '@/components/shared/logo'
import { stagger, fadeUp, inViewOnce } from '@/lib/motion'

/**
 * Concentric "orb" hero — three layered circles with gradient fills
 * and a custom-ping pulse on the inner ring + a halo around the
 * Strimz glyph. Direct evolution of the prior `strimz-subscription`
 * hero, but the orbiting tech logos are replaced with Strimz's own
 * primitives (USDC, EURC, Arc, Privy, Reown, Circle CCTP) which
 * better reflect the B2B audience.
 */
export function HeroOrb() {
  return (
    <motion.div
      {...inViewOnce}
      variants={stagger(0.2, 0.08)}
      className="relative mx-auto aspect-square w-[min(560px,100%)]"
    >
      {/* Ring 1 — outermost soft halo */}
      <motion.div variants={fadeUp} className="strimz-wave-1 absolute inset-0 rounded-full">
        <Ring2>
          <Ring3>
            {/* Strimz glyph at the core, with a green halo. */}
            <div className="relative flex h-[24%] w-[24%] items-center justify-center">
              <span aria-hidden className="absolute inline-block h-full w-full animate-ping rounded-full bg-[#02C76A]/70" />
              <div className="strimz-logo-shadow relative flex h-full w-full items-center justify-center rounded-full bg-white">
                <Glyph className="h-1/2 w-1/2" />
              </div>
            </div>
          </Ring3>

          {/* Orbiting primitive tags — instead of streaming logos. */}
          <OrbitTag tag="USDC" position="top-left" />
          <OrbitTag tag="EURC" position="top-right" />
          <OrbitTag tag="CCTP V2" position="middle-left" />
          <OrbitTag tag="Arc L1" position="middle-right" />
          <OrbitTag tag="Privy" position="bottom-left" />
          <OrbitTag tag="Reown" position="bottom-right" />
        </Ring2>
      </motion.div>
    </motion.div>
  )
}

function Ring2({ children }: { children: React.ReactNode }) {
  return (
    <div className="strimz-wave-2 absolute inset-[12%] flex items-center justify-center rounded-full">
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-[#02C76A]/30 animate-[custom-ping_1.4s_cubic-bezier(0,0,0.2,1)_infinite]"
        style={{ animationDelay: '500ms' }}
      />
      {children}
    </div>
  )
}

function Ring3({ children }: { children: React.ReactNode }) {
  return (
    <div className="strimz-wave-3 absolute inset-[28%] flex items-center justify-center rounded-full">
      {children}
    </div>
  )
}

const POSITIONS = {
  'top-left': 'left-[8%] top-[6%]',
  'top-right': 'right-[8%] top-[6%]',
  'middle-left': '-left-[2%] top-[42%]',
  'middle-right': '-right-[2%] top-[42%]',
  'bottom-left': 'left-[16%] bottom-[6%]',
  'bottom-right': 'right-[16%] bottom-[6%]',
} as const

function OrbitTag({ tag, position }: { tag: string; position: keyof typeof POSITIONS }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ scale: 1.06 }}
      transition={{ type: 'spring', stiffness: 220, damping: 14 }}
      className={`strimz-card-shadow absolute inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-xs font-medium ${POSITIONS[position]}`}
    >
      <span className="size-1.5 rounded-full bg-[#02C76A]" />
      {tag}
    </motion.div>
  )
}
