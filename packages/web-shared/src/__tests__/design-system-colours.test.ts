import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = join(__dirname, '..', '..', '..', '..')
const tokens = readFileSync(join(REPO, 'packages/ui/src/styles/globals.css'), 'utf8')

function block(selector: string): string {
  const start = tokens.indexOf(`${selector} {`)
  return tokens.slice(start, tokens.indexOf('\n  }', start))
}

function hex(hsl: string): string {
  const [h, s, l] = hsl.split(/\s+/u).map((v) => parseFloat(v))
  const a = ((s ?? 0) / 100) * Math.min((l ?? 0) / 100, 1 - (l ?? 0) / 100)
  const f = (n: number) => {
    const k = (n + (h ?? 0) / 30) % 12
    const c = (l ?? 0) / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase()
}

function token(selector: string, name: string): string {
  const m = block(selector).match(new RegExp(`--${name}:\\s*([^;]+);`, 'u'))
  if (!m?.[1]) throw new Error(`--${name} missing in ${selector}`)
  return hex(m[1].trim())
}

// Values from the Strimz UI Library (docs/design/strimz-design-system.md), #471.
const LIGHT: Record<string, string> = {
  background: '#FFFFFF',
  foreground: '#050020',
  card: '#FFFFFF',
  muted: '#F9FAFB',
  secondary: '#F3F4F6',
  'muted-foreground': '#58556A',
  tertiary: '#8E8C9C',
  border: '#E5E7EB',
  ring: '#100066',
  destructive: '#B42318',
  'brand-text': '#028D4B',
  success: '#01753E',
  'success-surface': '#F5FFFA',
  'success-border': '#94F9C9',
  warning: '#B54708',
  'warning-surface': '#FFFAEB',
  'warning-border': '#FEC84B',
  danger: '#B42318',
  'danger-surface': '#FEF3F2',
  'danger-border': '#FDA29B',
}

const DARK: Record<string, string> = {
  background: '#050020',
  foreground: '#FFFFFF',
  card: '#0D0A27',
  muted: '#13102D',
  'muted-foreground': '#B4B2C2',
  tertiary: '#8E8C9C',
  border: '#26233F',
  'brand-text': '#02C76A',
  danger: '#FDA29B',
  warning: '#FEC84B',
  success: '#63F6B1',
}

function files(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) return []
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/u.test(name) && !/\.test\.tsx?$/u.test(name) ? [path] : []
  })
}

const SOURCES = ['web', 'docs', 'dashboard', 'admin', 'checkout']
  .flatMap((a) => files(join(REPO, 'apps', a, 'src')))
  .concat(files(join(REPO, 'packages/web-shared/src')), files(join(REPO, 'packages/ui/src')))

describe('UI Library colours (#471)', () => {
  it.each(Object.entries(LIGHT))('light --%s is %s', (name, value) => {
    expect(token(':root', name)).toBe(value)
  })

  it.each(Object.entries(DARK))('dark --%s is %s', (name, value) => {
    expect(token('.dark', name)).toBe(value)
  })

  it('green text uses the brand text colour, not the fill green', () => {
    const hits = SOURCES.filter((f) =>
      /(?<![\w-])text-accent(?![\w-])/u.test(readFileSync(f, 'utf8')),
    )
    expect(hits.map((f) => relative(REPO, f))).toEqual([])
  })

  it('status colours come from the status tokens', () => {
    const ad = /(?<![\w-])(?:text|bg|border)-(?:rose|red|amber)-\d{2,3}(?:\/\d+)?(?![\w-])/u
    const hits = SOURCES.filter((f) => ad.test(readFileSync(f, 'utf8')))
    expect(hits.map((f) => relative(REPO, f))).toEqual([])
  })
})

describe('quieter hero (#471)', () => {
  const hero = readFileSync(join(REPO, 'apps/web/src/components/marketing/home/hero.tsx'), 'utf8')

  it('has no particle animation behind the card', () => {
    expect(hero).not.toMatch(/StreamField/u)
    expect(existsSync(join(REPO, 'apps/web/src/components/marketing/home/stream-field.tsx'))).toBe(
      false,
    )
  })

  it('has no gradient or grain wash', () => {
    expect(hero).not.toMatch(/radial-gradient|\bgrain\b/u)
  })

  it('has no border frame around the section', () => {
    expect(hero).not.toMatch(/ring-border|rounded-\[28px\]|rounded-\[36px\]/u)
  })

  it('keeps the rotating word', () => {
    expect(hero).toMatch(/<MorphWord/u)
  })
})

describe('dashboard sidebar in dark mode (#471)', () => {
  const sidebar = readFileSync(
    join(REPO, 'apps/dashboard/src/components/dashboard/sidebar.tsx'),
    'utf8',
  )

  it('hovers links with the secondary surface, not a white overlay', () => {
    expect(sidebar).not.toMatch(/hover:bg-white\//u)
    expect(sidebar).toMatch(/hover:bg-secondary/u)
  })

  it('keeps navy text on the white onboarding button', () => {
    expect(sidebar).toMatch(/text-ink[^"]*bg-white\/95|bg-white\/95[^"]*text-ink/u)
  })
})
