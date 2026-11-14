// Build-time origins of the five web apps. Defaults are the local dev ports.
export function siteUrls() {
  const pick = (name, port) => (process.env[name] || `http://localhost:${port}`).replace(/\/+$/, '')
  return {
    site: pick('NEXT_PUBLIC_SITE_URL', 3000),
    dashboard: pick('NEXT_PUBLIC_DASHBOARD_URL', 3001),
    checkout: pick('NEXT_PUBLIC_CHECKOUT_URL', 3002),
    docs: pick('NEXT_PUBLIC_DOCS_URL', 3003),
    admin: pick('NEXT_PUBLIC_ADMIN_URL', 3004),
  }
}
