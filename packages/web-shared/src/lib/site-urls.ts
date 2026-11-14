const trim = (url: string) => url.replace(/\/+$/, '')

// Origins of the five web apps (ADR-2026-11-14-split-web-into-workers).
// Inlined at build time; the defaults are the local dev ports.
export const siteUrls = {
  site: trim(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  dashboard: trim(process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3001'),
  checkout: trim(process.env.NEXT_PUBLIC_CHECKOUT_URL ?? 'http://localhost:3002'),
  docs: trim(process.env.NEXT_PUBLIC_DOCS_URL ?? 'http://localhost:3003'),
  admin: trim(process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3004'),
} as const
