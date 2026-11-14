/** Shared framer-motion variants for the dashboard and auth screens. */
import type { Transition, Variants } from 'framer-motion'

/** Springy but tasteful. Close to the iOS feel without going bouncy. */
export const tWelcome: Transition = {
  type: 'spring',
  stiffness: 130,
  damping: 16,
  mass: 0.8,
}

/** Slide-up fade. Staggered hero subtitles, list items in dashboards. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: tWelcome },
}

/** Container variants. Stagger children in sequence. */
export const stagger = (delayChildren = 0.1, stagger = 0.07): Variants => ({
  hidden: {},
  show: {
    transition: { delayChildren, staggerChildren: stagger },
  },
})

/** Reveal-on-scroll defaults that pair with `<motion.div whileInView />`. */
export const inViewOnce = {
  initial: 'hidden',
  whileInView: 'show',
  viewport: { once: true, amount: 0.3 },
} as const
