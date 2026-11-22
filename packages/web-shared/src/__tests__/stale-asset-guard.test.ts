import { describe, expect, it, vi } from 'vitest'

import {
  installStaleAssetGuard,
  STALE_ASSET_GUARD_SCRIPT,
  type GuardWindow,
} from '../lib/stale-asset-guard'

function fakeWindow(
  opts: { stylesheets?: { href: string; sheet: unknown }[]; storage?: 'ok' | 'blocked' } = {},
) {
  const listeners: Record<string, ((e: { target?: unknown }) => void)[]> = {}
  const store = new Map<string, string>()
  const reload = vi.fn()
  const win: GuardWindow = {
    addEventListener: (type, fn) => {
      ;(listeners[type] ??= []).push(fn as (e: { target?: unknown }) => void)
    },
    location: { reload },
    sessionStorage: {
      getItem: (k) => {
        if (opts.storage === 'blocked') throw new Error('blocked')
        return store.get(k) ?? null
      },
      setItem: (k, v) => {
        if (opts.storage === 'blocked') throw new Error('blocked')
        store.set(k, v)
      },
    },
    document: {
      querySelectorAll: () =>
        (opts.stylesheets ?? []) as unknown as ArrayLike<{ href: string; sheet: unknown }>,
    },
    Date: { now: () => 1_000_000 },
  }
  const fire = (type: string, target?: unknown) => listeners[type]?.forEach((fn) => fn({ target }))
  return { win, reload, fire }
}

const staleCss = { tagName: 'LINK', href: 'https://strimz.finance/_next/static/css/old.css' }
const staleJs = { tagName: 'SCRIPT', src: 'https://strimz.finance/_next/static/chunks/old.js' }

// #496: a page from an earlier deploy points at build files that no longer exist.
describe('stale build asset guard', () => {
  it('reloads once when a build stylesheet fails to load', () => {
    const { win, reload, fire } = fakeWindow()
    installStaleAssetGuard(win)
    fire('error', staleCss)
    fire('error', staleJs)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads when a build script fails to load', () => {
    const { win, reload, fire } = fakeWindow()
    installStaleAssetGuard(win)
    fire('error', staleJs)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads after load when a build stylesheet never applied', () => {
    const { win, reload, fire } = fakeWindow({
      stylesheets: [{ href: 'https://strimz.finance/_next/static/css/a.css', sheet: null }],
    })
    installStaleAssetGuard(win)
    fire('load')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves the page alone when every stylesheet applied', () => {
    const { win, reload, fire } = fakeWindow({
      stylesheets: [{ href: 'https://strimz.finance/_next/static/css/a.css', sheet: {} }],
    })
    installStaleAssetGuard(win)
    fire('load')
    expect(reload).not.toHaveBeenCalled()
  })

  it('ignores failures outside the build files, such as images or third parties', () => {
    const { win, reload, fire } = fakeWindow()
    installStaleAssetGuard(win)
    fire('error', { tagName: 'IMG', src: 'https://strimz.finance/_next/static/media/a.png' })
    fire('error', { tagName: 'SCRIPT', src: 'https://challenges.cloudflare.com/turnstile.js' })
    expect(reload).not.toHaveBeenCalled()
  })

  it('never reloads when it cannot remember it already did, so it cannot loop', () => {
    const { win, reload, fire } = fakeWindow({ storage: 'blocked' })
    installStaleAssetGuard(win)
    fire('error', staleCss)
    expect(reload).not.toHaveBeenCalled()
  })

  it('ships as a self-running inline script', () => {
    expect(STALE_ASSET_GUARD_SCRIPT).toMatch(/^\(function/u)
    expect(STALE_ASSET_GUARD_SCRIPT).toMatch(/\)\(window\)$/u)
  })
})
