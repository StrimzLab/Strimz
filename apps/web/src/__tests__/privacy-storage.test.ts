import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')
const APPS = join(WEB_ROOT, '..')
const privacy = readFileSync(join(WEB_ROOT, 'src/app/(marketing)/legal/privacy/page.tsx'), 'utf8')

// Strimz needs no consent banner only while nothing optional is stored or loaded (#466).
const TRACKERS =
  /@vercel\/analytics|posthog|mixpanel|plausible|@sentry\/|react-ga|gtag|googletagmanager|hotjar|clarity|segment\.(com|io)|facebook\.net|@next\/third-parties/iu

describe('privacy policy discloses browser storage (#466)', () => {
  it('no longer claims an analytics setup', () => {
    expect(privacy).not.toMatch(/analytics setup/iu)
  })

  it('has a cookies and local storage section naming each stored value', () => {
    expect(privacy).toMatch(/id="storage"/u)
    for (const key of [
      'strimz-theme',
      'strimz.tour.completed',
      'strimz.refund.broadcast.',
      'Privy',
    ]) {
      expect(privacy).toContain(key)
    }
  })

  it('names current hosting, not the old providers', () => {
    expect(privacy).not.toMatch(/\bRender\b|\bVercel\b/u)
    expect(privacy).toMatch(/OVH/u)
  })

  it('covers the African data protection laws of the markets we serve', () => {
    for (const law of ['Nigeria Data Protection Act', 'Kenya', 'Ghana']) {
      expect(privacy).toContain(law)
    }
  })
})

describe('no tracking scripts without a consent banner (#466)', () => {
  const apps = readdirSync(APPS).filter((a) => {
    try {
      readFileSync(join(APPS, a, 'package.json'))
      return true
    } catch {
      return false
    }
  })

  it.each(apps)('%s has no analytics or ad dependency', (app) => {
    expect(readFileSync(join(APPS, app, 'package.json'), 'utf8')).not.toMatch(TRACKERS)
  })
})
