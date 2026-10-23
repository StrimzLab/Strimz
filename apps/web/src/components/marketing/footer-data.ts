import { NAV_GROUPS, NAV_LINKS, type NavGroup } from './nav-data'

export interface FooterLink {
  href: string
  label: string
  external?: boolean
}

export interface FooterColumn {
  label: string
  links: readonly FooterLink[]
}

const GITHUB = 'https://github.com/StrimzLab/strimz'

const links = (group: NavGroup) => group.items.map(({ href, label }) => ({ href, label }))

const extras: Record<string, readonly FooterLink[]> = {
  Product: NAV_LINKS.map(({ href, label }) => ({ href, label })),
  Developers: [{ href: GITHUB, label: 'GitHub', external: true }],
}

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  ...NAV_GROUPS.map((group) => ({
    label: group.label,
    links: [...links(group), ...(extras[group.label] ?? [])],
  })),
  {
    label: 'Legal',
    links: [
      { href: '/legal/terms', label: 'Terms of Service' },
      { href: '/legal/privacy', label: 'Privacy Policy' },
      { href: '/legal/acceptable-use', label: 'Acceptable use' },
    ],
  },
]
