'use client'

import { motion, useScroll, useSpring } from 'framer-motion'

/**
 * Thin progress bar pinned to the top of the viewport that tracks the
 * page's scroll position. Borrowed from the strimz-subscription nav and
 * kept as its own component so any layout (marketing, docs) can opt in.
 */
export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })
  return (
    <motion.div
      className="fixed top-0 right-0 left-0 z-[60] h-[3px] origin-left bg-[#02C76A]"
      style={{ scaleX }}
      aria-hidden
    />
  )
}
