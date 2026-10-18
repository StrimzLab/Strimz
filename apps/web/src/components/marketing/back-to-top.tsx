'use client'

import { useEffect, useRef, useState } from 'react'
import arrowUpIcon from '@iconify-icons/solar/arrow-up-linear'
import { cn } from '@strimz/ui'
import { MkIcon } from './icon'

const RING = 2 * Math.PI * 19

export function BackToTop() {
  const [shown, setShown] = useState(false)
  const ringRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0
      ringRef.current?.style.setProperty('stroke-dashoffset', String(RING * (1 - progress)))
      setShown(window.scrollY > window.innerHeight)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <a
      href="#top"
      onClick={(e) => {
        // Lenis handles #top itself; this keeps the hash out of the URL and covers reduced motion.
        e.preventDefault()
        if (!document.documentElement.classList.contains('lenis')) window.scrollTo({ top: 0 })
      }}
      aria-label="Back to top"
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      data-tone="neutral"
      data-size="sm"
      className={cn(
        'pop-button fixed bottom-4 right-4 z-50 grid size-11 place-items-center rounded-full sm:bottom-6 sm:right-6 sm:size-12',
        shown ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0',
      )}
    >
      <svg aria-hidden viewBox="0 0 44 44" className="absolute inset-0.5 -rotate-90">
        <circle
          ref={ringRef}
          cx="22"
          cy="22"
          r="19"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-accent"
          style={{ strokeDasharray: RING, strokeDashoffset: RING }}
        />
      </svg>
      <MkIcon icon={arrowUpIcon} className="relative size-5" />
    </a>
  )
}
