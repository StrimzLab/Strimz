'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from './gsap'
import { startSmoothScroll } from './scroll-engine'

export function SmoothScroll() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    let stop: (() => void) | null = null

    const sync = () => {
      if (query.matches) {
        stop?.()
        stop = null
        return
      }
      if (stop) return
      gsap.ticker.lagSmoothing(0)
      stop = startSmoothScroll({
        create: () => new Lenis({ autoRaf: false, anchors: true, lerp: 0.12 }),
        ticker: gsap.ticker,
        onScroll: ScrollTrigger.update,
      })
    }

    sync()
    query.addEventListener('change', sync)
    return () => {
      query.removeEventListener('change', sync)
      stop?.()
    }
  }, [])

  return null
}
