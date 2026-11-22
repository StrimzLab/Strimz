import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RouteLoader } from '../components/route-loader'

const css = readFileSync(join(__dirname, '../styles/globals.css'), 'utf8')
const apps = join(__dirname, '../../../../apps')

// #537: page changes on a slow phone looked frozen.
describe('RouteLoader', () => {
  const html = renderToStaticMarkup(<RouteLoader />)

  it('announces itself to screen readers and hides the dots', () => {
    expect(html).toMatch(/role="status"/u)
    expect(html).toContain('<span class="sr-only">Loading</span>')
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*mk-loader/u)
  })

  it('uses the brand colour, so it suits light and dark', () => {
    expect(html).toMatch(/mk-loader[^"]*text-brand-text/u)
  })

  it('fades in late so quick page changes never flash it, and holds still with reduced motion', () => {
    const block = css.slice(css.indexOf('/* Route loader'))
    expect(block).toMatch(/\.mk-route-loader\s*\{[^}]*animation:[^}]*\b0\.\d+s backwards/u)
    expect(block).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{\s*\.mk-loader\s*\{\s*animation: none/u,
    )
  })
})

const SEGMENTS = [
  'web/src/app/(marketing)/loading.tsx',
  'dashboard/src/app/(dashboard)/app/loading.tsx',
  'dashboard/src/app/(auth)/loading.tsx',
  'checkout/src/app/(checkout)/loading.tsx',
  'checkout/src/app/store/[slug]/loading.tsx',
  'admin/src/app/(admin)/loading.tsx',
  'docs/src/app/docs/loading.tsx',
]

describe('route loading screens', () => {
  it.each(SEGMENTS)('%s shows the shared loader', (file) => {
    const path = join(apps, file)
    expect(existsSync(path)).toBe(true)
    const code = readFileSync(path, 'utf8')
    expect(code).toContain("from '@strimz/web-shared/components/route-loader'")
    expect(code).toContain('<RouteLoader')
  })
})
