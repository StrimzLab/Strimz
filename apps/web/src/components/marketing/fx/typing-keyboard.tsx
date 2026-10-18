'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@strimz/ui'

// Adapted from Vengeance UI's Typing Keyboard (MIT): themed, paused off-screen, still under reduced motion.

type KeySpec = { w?: 'w2' | 'w3' | 'w6'; tone?: 'accent' | 'mint' }

const WIDTH = { w2: 60, w3: 90, w6: 195 } as const

const ROWS: KeySpec[][] = [
  [{ tone: 'accent' }, ...Array<KeySpec>(12).fill({}), { w: 'w2', tone: 'accent' }],
  [{ w: 'w2', tone: 'accent' }, ...Array<KeySpec>(12).fill({}), { tone: 'accent' }],
  [{ w: 'w3', tone: 'accent' }, ...Array<KeySpec>(10).fill({}), { w: 'w2', tone: 'mint' }],
  [{ w: 'w2', tone: 'accent' }, ...Array<KeySpec>(11).fill({}), { w: 'w3', tone: 'accent' }],
  [
    { tone: 'accent' },
    { tone: 'mint' },
    { tone: 'accent' },
    { tone: 'accent' },
    { w: 'w6' },
    ...Array<KeySpec>(5).fill({ tone: 'accent' }),
  ],
]

const LETTERS: Record<string, number> = {}
'QWERTYUIOP'.split('').forEach((c, i) => (LETTERS[c] = 15 + i))
'ASDFGHJKL'.split('').forEach((c, i) => (LETTERS[c] = 29 + i))
'ZXCVBNM'.split('').forEach((c, i) => (LETTERS[c] = 41 + i))
LETTERS[' '] = 56
LETTERS['\n'] = 39

function Key({ spec }: { spec: KeySpec }) {
  const w = spec.w ? WIDTH[spec.w] : 30
  return (
    <div
      className={cn('tk-key tk-flex', spec.w, spec.tone)}
      style={{ '--w': `${w}px` } as React.CSSProperties}
    >
      <div className="front tk-face" />
      <div className="back tk-face" />
      <div className="side tk-face" />
      <div className="side left tk-face" />
      <div className="top tk-face" />
    </div>
  )
}

export function TypingKeyboard({ script, className }: { script: string; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const text = textRef.current
    if (!root || !text) return
    const fit = () => {
      const scale = Math.min(0.85, root.clientWidth / 760)
      root.style.setProperty('--tk-scale', String(scale))
      root.style.height = `${600 * scale}px`
    }
    fit()
    const resize = new ResizeObserver(fit)
    resize.observe(root)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      text.textContent = script
      return () => resize.disconnect()
    }

    text.textContent = ''
    const keys = root.querySelectorAll<HTMLElement>('.tk-key')
    let index = 0
    let timer = 0
    let visible = false
    let running = false

    const press = (char: string) => {
      const at = LETTERS[char.toUpperCase()] ?? Math.floor(Math.random() * 13) + 1
      const key = keys[at]
      if (!key) return
      key.classList.add('down')
      window.setTimeout(() => key.classList.remove('down'), 90)
    }

    const step = () => {
      if (!visible || document.hidden) {
        running = false
        return
      }
      const char = script[index]
      if (char === undefined) {
        timer = window.setTimeout(() => {
          index = 0
          text.textContent = ''
          step()
        }, 2600)
        return
      }
      press(char)
      text.textContent += char
      index++
      const pause = char === '\n' ? 420 : 35 + Math.random() * 75
      timer = window.setTimeout(step, pause)
    }

    const start = () => {
      if (running || !visible || document.hidden) return
      running = true
      timer = window.setTimeout(step, 400)
    }
    const view = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      start()
    })
    view.observe(root)
    const onVisibility = () => start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearTimeout(timer)
      view.disconnect()
      resize.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [script])

  return (
    <div ref={rootRef} aria-hidden className={cn('tk w-full min-w-0 overflow-x-clip', className)}>
      <div className="tk-main tk-flex">
        <div className="tk-keyboard tk-flex">
          <div className="tk-screen tk-flex">
            <p>
              <span ref={textRef} />
              <span className="tk-caret" />
            </p>
          </div>
          <div className="tk-keyboard__front tk-face" />
          <div className="tk-keyboard__back tk-face" />
          <div className="tk-keyboard__right tk-face" />
          <div className="tk-keyboard__left tk-face" />
          <div className="tk-keyboard__top tk-face">
            {ROWS.map((row, r) => (
              <div key={r} className="tk-keys">
                {row.map((spec, k) => (
                  <Key key={k} spec={spec} />
                ))}
              </div>
            ))}
          </div>
          <div className="tk-keyboard__bottom tk-face" />
        </div>
      </div>
    </div>
  )
}
