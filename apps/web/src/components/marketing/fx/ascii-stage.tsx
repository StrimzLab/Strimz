'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '../motion/gsap'

// Adapted from Vengeance UI's Animated Footer (MIT): images redrawn as ASCII that lights up near the cursor.

const CHARS = '..::=+xX#0369'
const LIFETIME = 320
const CLUSTER = 10

interface Cell {
  col: number
  row: number
  char: string
  tone: 0 | 1 | 2
  litUntil: number
}

const PALETTES = {
  dark: {
    tones: ['rgba(2, 199, 106, 0.35)', 'rgba(2, 199, 106, 0.85)', '#95FECC'],
    lit: '#95FECC',
    litText: '#050020',
  },
  light: {
    tones: ['rgba(2, 141, 75, 0.3)', 'rgba(2, 141, 75, 0.75)', '#027A43'],
    lit: '#02C76A',
    litText: '#FFFFFF',
  },
} as const

interface Art {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  cells: Map<string, Cell>
  list: Cell[]
  rows: number
}

function sample(
  image: HTMLImageElement,
  columns: number,
): { rows: number; cells: Map<string, Cell> } {
  const rows = Math.max(1, Math.round(columns / (image.naturalWidth / image.naturalHeight || 1)))
  const sampler = document.createElement('canvas')
  sampler.width = columns
  sampler.height = rows
  const ctx = sampler.getContext('2d')
  const cells = new Map<string, Cell>()
  if (!ctx) return { rows, cells }
  ctx.drawImage(image, 0, 0, columns, rows)
  const px = ctx.getImageData(0, 0, columns, rows).data
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const o = (row * columns + col) * 4
      const alpha = (px[o + 3] ?? 0) / 255
      if (alpha < 0.4) continue
      const lum = ((px[o] ?? 0) * 0.299 + (px[o + 1] ?? 0) * 0.587 + (px[o + 2] ?? 0) * 0.114) / 255
      const char = CHARS[Math.min(CHARS.length - 1, Math.floor(lum * CHARS.length))] ?? '.'
      const tone = lum > 0.62 ? 2 : lum > 0.32 ? 1 : 0
      cells.set(`${col},${row}`, { col, row, char, tone, litUntil: 0 })
    }
  }
  return { rows, cells }
}

function light(cells: Map<string, Cell>, start: Cell) {
  const now = performance.now()
  start.litUntil = now + LIFETIME
  let current = start
  const lit = new Set([start])
  for (let step = 0; step < Math.floor(Math.random() * CLUSTER) + 1; step++) {
    const around: Cell[] = []
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const n = cells.get(`${current.col + dx},${current.row + dy}`)
        if (n && !lit.has(n)) around.push(n)
      }
    const next = around[Math.floor(Math.random() * around.length)]
    if (!next) break
    next.litUntil = now + LIFETIME + step * 12
    lit.add(next)
    current = next
  }
}

export function AsciiStage({
  left,
  right,
  columns = 54,
  cell = 14,
  className,
}: {
  left: string
  right: string
  columns?: number
  cell?: number
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLCanvasElement>(null)
  const rightRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const canvases = [leftRef.current, rightRef.current]
    if (!root || !canvases[0] || !canvases[1]) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const arts: Art[] = []
    const curtain = { offset: still ? 0 : 110 }
    const drift = { x: 0, y: 0, tx: 0, ty: 0 }
    let frame = 0
    let visible = false
    let disposed = false
    const html = document.documentElement
    let palette = PALETTES[html.classList.contains('dark') ? 'dark' : 'light']

    const draw = (art: Art, now: number) => {
      const { ctx, list, rows } = art
      ctx.clearRect(0, 0, columns * cell, rows * cell)
      for (const c of list) {
        const on = c.litUntil > now
        if (on) {
          ctx.fillStyle = palette.lit
          ctx.fillRect(c.col * cell, c.row * cell, cell, cell)
        }
        ctx.fillStyle = on ? palette.litText : palette.tones[c.tone]
        ctx.fillText(c.char, c.col * cell + cell / 2, c.row * cell + cell * 0.78)
      }
    }

    const place = () => {
      canvases.forEach((canvas, i) => {
        const wrap = canvas?.parentElement
        if (!wrap) return
        const dir = i === 0 ? -1 : 1
        wrap.style.transform = `translateX(${dir * curtain.offset}%) translate(${drift.x * -dir}px, ${drift.y}px)`
      })
    }

    const tick = () => {
      const now = performance.now()
      drift.x += (drift.tx - drift.x) * 0.06
      drift.y += (drift.ty - drift.y) * 0.06
      arts.forEach((a) => draw(a, now))
      place()
      frame = visible && !document.hidden && !still ? requestAnimationFrame(tick) : 0
    }
    const resume = () => {
      if (!frame && visible && !document.hidden && !still) frame = requestAnimationFrame(tick)
    }

    const load = (src: string, canvas: HTMLCanvasElement) => {
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => {
        if (disposed) return
        const { rows, cells } = sample(image, columns)
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = columns * cell * dpr
        canvas.height = rows * cell * dpr
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.font = `600 ${cell - 2}px ui-monospace, Menlo, monospace`
        ctx.textAlign = 'center'
        const art = { canvas, ctx, cells, list: [...cells.values()], rows }
        arts.push(art)
        draw(art, 0)
        canvas.dataset.state = 'ready'
      }
      image.onerror = () => {
        canvas.dataset.state = 'failed'
        console.error(`[footer] could not load ${src} for the ASCII art`)
      }
      image.src = src
    }
    load(left, canvases[0])
    load(right, canvases[1])

    const onMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect()
      drift.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 30
      drift.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 20
      for (const art of arts) {
        const r = art.canvas.getBoundingClientRect()
        if (r.width === 0) continue
        const col = ((e.clientX - r.left) / r.width) * columns
        const row = ((e.clientY - r.top) / r.height) * art.rows
        let best: Cell | null = null
        let bestDist = Infinity
        for (const c of art.list) {
          const d = (c.col - col) ** 2 + (c.row - row) ** 2
          if (d < bestDist) {
            bestDist = d
            best = c
          }
        }
        if (best && bestDist < 36) light(art.cells, best)
      }
    }
    if (fine && !still) window.addEventListener('pointermove', onMove, { passive: true })

    const view = new IntersectionObserver(
      ([entry]) => {
        const nowVisible = entry?.isIntersecting ?? false
        if (nowVisible && !visible && !still) {
          gsap.to(curtain, { offset: 0, duration: 1.4, ease: 'power3.out', overwrite: true })
        }
        visible = nowVisible
        resume()
      },
      { threshold: 0.2 },
    )
    view.observe(root)
    const onVisibility = () => resume()
    document.addEventListener('visibilitychange', onVisibility)
    const theme = new MutationObserver(() => {
      palette = PALETTES[html.classList.contains('dark') ? 'dark' : 'light']
      arts.forEach((a) => draw(a, performance.now()))
    })
    theme.observe(html, { attributes: true, attributeFilter: ['class'] })
    place()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      view.disconnect()
      theme.disconnect()
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', onVisibility)
      gsap.killTweensOf(curtain)
    }
  }, [left, right, columns, cell])

  return (
    <div ref={rootRef} aria-hidden className={className}>
      <div className="flex items-center justify-between gap-6">
        <div className="w-[38%] max-w-[420px] will-change-transform">
          <canvas
            ref={leftRef}
            className="block h-auto w-full opacity-0 transition-opacity duration-700 data-[state=ready]:opacity-100"
          />
        </div>
        <div className="w-[38%] max-w-[420px] will-change-transform">
          <canvas
            ref={rightRef}
            className="block h-auto w-full opacity-0 transition-opacity duration-700 data-[state=ready]:opacity-100"
          />
        </div>
      </div>
    </div>
  )
}
