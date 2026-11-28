/** The tour anchor for a sidebar link: `/app` is `nav-home`, `/app/plans` is `nav-plans`. */
export function tourKeyFor(href: string): string | undefined {
  if (href === '/app') return 'nav-home'
  const segment = /^\/app\/([^/]+)/u.exec(href)?.[1]
  return segment ? `nav-${segment}` : undefined
}
