import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { siteUrls } from '@strimz/web-shared/lib/site-urls'

const APPS = join(__dirname, '..', '..', '..')
const DOCS = join(APPS, 'docs', 'content', 'docs')

type App = keyof typeof siteUrls

/** Which Strimz app an absolute link points at, and its path there. */
export function appLink(href: string): { app: App | 'external' | 'web'; path: string } {
  for (const app of Object.keys(siteUrls) as App[]) {
    const origin = siteUrls[app]
    if (href === origin || href.startsWith(`${origin}/`) || href.startsWith(`${origin}#`)) {
      return { app, path: href.slice(origin.length) || '/' }
    }
  }
  return href.startsWith('http') ? { app: 'external', path: href } : { app: 'web', path: href }
}

export function docExists(path: string): boolean {
  const rest = path.replace(/^\/docs\/?/u, '').split('#')[0] ?? ''
  if (!rest) return existsSync(join(DOCS, 'index.mdx'))
  return existsSync(join(DOCS, `${rest}.mdx`)) || existsSync(join(DOCS, rest, 'index.mdx'))
}

export function dashboardRouteExists(path: string): boolean {
  const route = path.split('#')[0]?.replace(/^\//u, '') ?? ''
  return ['(auth)', '(dashboard)'].some((g) =>
    existsSync(join(APPS, 'dashboard', 'src', 'app', g, route, 'page.tsx')),
  )
}
