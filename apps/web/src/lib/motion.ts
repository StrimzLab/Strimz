/**
 * Shared framer-motion variants. Centralised so every animated surface
 * (hero, feature grid, dashboard cards, callbacks) shares the same
 * easing curve and timing — that's what makes a site feel polished
 * rather than just "animated".
 */
import type { Transition, Variants } from 'framer-motion'

/** Springy but tasteful — close to the iOS feel without going bouncy. */
export const tWelcome: Transition = {
  type: 'spring',
  stiffness: 130,
  damping: 16,
  mass: 0.8,
}

/** Slide-up fade — staggered hero subtitles, list items in dashboards. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: tWelcome },
}

/** Scale-in for cards, KPI tiles, modals. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: tWelcome },
}

/** Container variants — stagger children in sequence. */
export const stagger = (delayChildren = 0.1, stagger = 0.07): Variants => ({
  hidden: {},
  show: {
    transition: { delayChildren, staggerChildren: stagger },
  },
})

/** Marquee-friendly entrance — used for trusted-by row, feature pills. */
export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  show: { opacity: 1, x: 0, transition: tWelcome },
}

/** Reveal-on-scroll defaults that pair with `<motion.div whileInView />`. */
export const inViewOnce = {
  initial: 'hidden',
  whileInView: 'show',
  viewport: { once: true, amount: 0.3 },
} as const
