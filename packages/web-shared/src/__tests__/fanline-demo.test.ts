import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP = join(__dirname, '..', '..', '..', '..', 'apps', 'demo-merchant')
const read = (path: string) => readFileSync(join(APP, path), 'utf8')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/u.test(name) ? [path] : []
  })
}

const ui = files(join(APP, 'src', 'components')).concat(files(join(APP, 'src', 'app')))
const copy = ui.map((f) => readFileSync(f, 'utf8')).join('\n')

describe('Fanline demo (#469)', () => {
  it('does not compare itself with other platforms', () => {
    expect(copy).not.toMatch(/Patreon|Ko-fi|Substack|chargeback|30% platform cut/iu)
  })

  it('does not lead with the network name', () => {
    expect(copy).not.toMatch(/\bon Arc\b|\bArc testnet\b/u)
  })

  it('says plainly that it is a testnet demo built on Strimz', () => {
    expect(read('src/components/Footer.tsx')).toMatch(/demo/iu)
    expect(read('src/components/Footer.tsx')).toMatch(/test USDC/iu)
  })

  it('features creators from East and West Africa', () => {
    const creators = read('src/lib/creators.ts')
    for (const city of ['Lagos', 'Accra', 'Nairobi']) expect(creators).toContain(city)
  })

  it('has a light and dark theme toggle', () => {
    expect(read('src/components/Nav.tsx')).toMatch(/<ThemeToggle/u)
  })

  it('builds the Worker without esbuild name helpers, which broke the theme script', () => {
    expect(read('wrangler.jsonc')).toMatch(/"keep_names":\s*false/u)
  })

  it('keeps the API URL in wrangler config so a redeploy does not drop it', () => {
    expect(read('wrangler.jsonc')).toMatch(/"STRIMZ_API_URL":\s*"https:\/\/api\.strimz\.finance"/u)
  })

  it('shows the Pro error in a colour that reads on the card in both themes', () => {
    const pro = read('src/components/ProCard.tsx')
    const alert = pro.match(/role="alert"\s+className="([^"]+)"/u)?.[1] ?? ''
    expect(alert).toMatch(/\bdark:text-/u)
    expect(alert).not.toMatch(/text-red-300/u)
  })

  it('serves a favicon, robots.txt and a sitemap', () => {
    expect(existsSync(join(APP, 'src', 'app', 'icon.svg'))).toBe(true)
    expect(existsSync(join(APP, 'src', 'app', 'robots.ts'))).toBe(true)
    expect(existsSync(join(APP, 'src', 'app', 'sitemap.ts'))).toBe(true)
  })
})
