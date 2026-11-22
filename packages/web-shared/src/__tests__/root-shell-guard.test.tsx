import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// next/font only runs inside the Next compiler.
vi.mock('../lib/fonts', () => ({ fontVariables: '' }))
vi.mock('../styles/globals.css', () => ({}))

import { RootShell } from '../components/root-shell'
import { STALE_ASSET_GUARD_SCRIPT } from '../lib/stale-asset-guard'

// #496: every app gets the guard, before any of its content.
describe('RootShell', () => {
  it('runs the stale build file guard first in the body', () => {
    const html = renderToStaticMarkup(RootShell({ children: <main>content</main> }))
    const body = html.slice(html.indexOf('<body'))
    expect(body.indexOf(STALE_ASSET_GUARD_SCRIPT)).toBeGreaterThan(-1)
    expect(body.indexOf(STALE_ASSET_GUARD_SCRIPT)).toBeLessThan(body.indexOf('<main>'))
  })
})
