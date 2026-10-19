'use client'

import { useRef, type ReactNode } from 'react'
import { cn } from '@strimz/ui'
import { EASE_OUT, MOTION_OK, PLAY_ONCE, gsap, useGSAP } from '../motion/gsap'

/** Children marked data-rise come up in turn the first time the group scrolls into view. */
export function RiseIn({ children, className }: { children: ReactNode; className?: string }) {
  const scope = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap.from('[data-rise]', {
          y: 40,
          autoAlpha: 0,
          duration: 0.9,
          stagger: 0.08,
          ease: EASE_OUT,
          scrollTrigger: { trigger: scope.current, start: 'top 82%', ...PLAY_ONCE },
        })
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <div ref={scope} className={cn(className)}>
      {children}
    </div>
  )
}
