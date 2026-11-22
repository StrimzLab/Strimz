'use client'

import { useEffect } from 'react'
import { gsap, ScrollTrigger } from '@strimz/web-shared/components/marketing/motion/gsap'
import { shouldSmoothScroll, startSmoothScroll } from './scroll-engine'

export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fine = window.matchMedia('(pointer: fine)')
    let stop: (() => void) | null = null
    let alive = true
    let loading = false

    const sync = async () => {
      if (!shouldSmoothScroll({ reducedMotion: reduced.matches, finePointer: fine.matches })) {
        stop?.()
        stop = null
        return
      }
      if (stop || loading) return
      loading = true
      // Lenis stays out of the first-load bundle.
      const { default: Lenis } = await import('lenis')
      loading = false
      if (!alive || stop) return
      if (!shouldSmoothScroll({ reducedMotion: reduced.matches, finePointer: fine.matches })) return
      gsap.ticker.lagSmoothing(0)
      stop = startSmoothScroll({
        create: () => new Lenis({ autoRaf: false, anchors: true, lerp: 0.12 }),
        ticker: gsap.ticker,
        onScroll: ScrollTrigger.update,
      })
    }
    const onChange = () => void sync()

    onChange()
    reduced.addEventListener('change', onChange)
    fine.addEventListener('change', onChange)
    return () => {
      alive = false
      reduced.removeEventListener('change', onChange)
      fine.removeEventListener('change', onChange)
      stop?.()
    }
  }, [])

  return null
}
