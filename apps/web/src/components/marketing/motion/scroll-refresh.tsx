'use client'

import { useEffect } from 'react'
import { ScrollTrigger } from './gsap'

/** Lazy sections, fonts and images change the page height after ScrollTrigger has measured it. */
export function ScrollRefresh() {
  useEffect(() => {
    let timer = 0
    let height = document.documentElement.scrollHeight
    const refresh = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 150)
    }
    const watch = new ResizeObserver(() => {
      const next = document.documentElement.scrollHeight
      if (Math.abs(next - height) < 2) return
      height = next
      refresh()
    })
    watch.observe(document.body)
    void document.fonts?.ready.then(refresh)
    return () => {
      window.clearTimeout(timer)
      watch.disconnect()
    }
  }, [])
  return null
}
