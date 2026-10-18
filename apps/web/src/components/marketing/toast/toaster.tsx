'use client'

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import checkIcon from '@iconify-icons/solar/check-circle-bold'
import dangerIcon from '@iconify-icons/solar/danger-circle-bold'
import infoIcon from '@iconify-icons/solar/info-circle-bold'
import closeIcon from '@iconify-icons/solar/close-circle-linear'
import { cn } from '@strimz/ui'
import { MkIcon } from '../icon'
import { EASE_OUT, gsap } from '../motion/gsap'
import { getServerToasts, getToasts, subscribe, toast, type ToastItem } from './store'

const TONES = {
  success: { icon: checkIcon, colour: 'text-accent', bar: 'bg-accent' },
  error: { icon: dangerIcon, colour: 'text-destructive', bar: 'bg-destructive' },
  info: { icon: infoIcon, colour: 'text-step-blue', bar: 'bg-step-blue' },
} as const

const GAP = 10

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function Toast({ item, onLeave }: { item: ToastItem; onLeave: (id: string) => void }) {
  const tone = TONES[item.tone]
  return (
    <li
      data-toast={item.id}
      role={item.tone === 'error' ? 'alert' : 'status'}
      className="border-border bg-card group/toast pointer-events-auto absolute bottom-0 right-0 w-full overflow-hidden rounded-2xl border shadow-[0_24px_60px_-24px_rgb(5_0_32/0.45)]"
    >
      <div className="flex items-start gap-3 p-4 pr-11">
        <MkIcon icon={tone.icon} className={cn('mt-0.5 size-5 shrink-0', tone.colour)} />
        <div className="min-w-0">
          <p className="font-poppins text-foreground text-sm font-semibold">{item.title}</p>
          {item.description ? (
            <p className="font-poppins text-muted-foreground mt-0.5 text-[13px] leading-snug">
              {item.description}
            </p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onLeave(item.id)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-accent absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2"
      >
        <MkIcon icon={closeIcon} className="size-5" />
      </button>
      <span
        aria-hidden
        onAnimationEnd={() => onLeave(item.id)}
        style={{ animationDuration: `${item.duration}ms` }}
        className={cn(
          'toast-timer absolute bottom-0 left-0 h-0.5 w-full origin-left opacity-70',
          tone.bar,
        )}
      />
    </li>
  )
}

/** Our own toaster for the marketing site: stacked, pausable, and readable by screen readers. */
export function Toaster() {
  const items = useSyncExternalStore(subscribe, getToasts, getServerToasts)
  const listRef = useRef<HTMLOListElement>(null)
  const [expanded, setExpanded] = useState(false)
  const seen = useRef(new Set<string>())
  const leaving = useRef(new Set<string>())

  const leave = (id: string) => {
    if (leaving.current.has(id)) return
    leaving.current.add(id)
    const el = listRef.current?.querySelector(`[data-toast="${id}"]`)
    const done = () => {
      leaving.current.delete(id)
      seen.current.delete(id)
      toast.dismiss(id)
    }
    if (!el || reducedMotion()) return done()
    gsap.to(el, { x: 40, autoAlpha: 0, duration: 0.3, ease: 'power2.in', onComplete: done })
  }

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const els = items
      .map((t) => list.querySelector<HTMLElement>(`[data-toast="${t.id}"]`))
      .filter((el): el is HTMLElement => el !== null)
    const instant = reducedMotion()
    let offset = 0
    els.forEach((el, i) => {
      const id = items[i]?.id ?? ''
      const y = expanded ? -offset : -i * 12
      const scale = expanded ? 1 : 1 - i * 0.05
      offset += el.offsetHeight + GAP
      if (!seen.current.has(id)) {
        seen.current.add(id)
        if (!instant) {
          gsap.fromTo(
            el,
            { y: 40, scale: 0.95, autoAlpha: 0 },
            { y, scale, autoAlpha: 1, duration: 0.55, ease: EASE_OUT },
          )
          return
        }
      }
      gsap.to(el, {
        y,
        scale,
        autoAlpha: expanded || i < 3 ? 1 : 0,
        zIndex: items.length - i,
        duration: instant ? 0 : 0.45,
        ease: EASE_OUT,
      })
    })
    list.style.height = `${expanded ? offset : (els[0]?.offsetHeight ?? 0) + Math.min(els.length - 1, 2) * 12}px`
  }, [items, expanded])

  return (
    <section
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-3 bottom-20 z-[60] sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[380px]"
    >
      <ol
        ref={listRef}
        aria-live="polite"
        onPointerEnter={() => setExpanded(true)}
        onPointerLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setExpanded(false)
        }}
        className={cn('relative transition-[height] duration-300', expanded && 'toasts-paused')}
      >
        {items.map((item) => (
          <Toast key={item.id} item={item} onLeave={leave} />
        ))}
      </ol>
    </section>
  )
}
