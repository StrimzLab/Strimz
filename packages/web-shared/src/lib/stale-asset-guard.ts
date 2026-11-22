interface AssetTarget {
  tagName?: string
  href?: string
  src?: string
}

export interface GuardWindow {
  addEventListener(
    type: string,
    listener: (event: { target?: unknown }) => void,
    capture?: boolean,
  ): void
  location: { reload(): void }
  sessionStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void }
  document: { querySelectorAll(selector: string): ArrayLike<{ href: string; sheet: unknown }> }
  Date: { now(): number }
}

/**
 * A page from an earlier deploy points at build files that no longer exist, so it
 * renders unstyled or never hydrates (#496). Reload once to get the current page.
 * Runs as an inline script, so it must not reference anything outside itself.
 */
export function installStaleAssetGuard(win: GuardWindow): void {
  const key = 'strimz:stale-asset-reload'
  const isBuildFile = (url: string | undefined) =>
    typeof url === 'string' && url.indexOf('/_next/static/') !== -1
  let done = false
  const reload = () => {
    if (done) return
    done = true
    try {
      const last = Number(win.sessionStorage.getItem(key) || 0)
      // At most once a minute per tab, so a broken deploy can't loop.
      if (win.Date.now() - last < 60_000) return
      win.sessionStorage.setItem(key, String(win.Date.now()))
    } catch {
      return
    }
    win.location.reload()
  }
  win.addEventListener(
    'error',
    (event) => {
      const t = event.target as AssetTarget | undefined
      if (!t) return
      if (t.tagName === 'LINK' && isBuildFile(t.href)) reload()
      else if (t.tagName === 'SCRIPT' && isBuildFile(t.src)) reload()
    },
    true,
  )
  win.addEventListener('load', () => {
    const sheets = win.document.querySelectorAll('link[rel="stylesheet"]')
    for (let i = 0; i < sheets.length; i++) {
      const link = sheets[i]
      if (link && isBuildFile(link.href) && !link.sheet) return reload()
    }
  })
}

export const STALE_ASSET_GUARD_SCRIPT = `(${installStaleAssetGuard.toString()})(window)`
