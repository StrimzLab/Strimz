import Link from 'next/link'
import { FaXTwitter, FaLinkedin, FaGithub } from 'react-icons/fa6'
import { Logo } from '@/components/shared/logo'

const COLUMNS = [
  {
    label: 'Product',
    links: [
      { href: '/pricing', label: 'Pricing' },
      { href: '/customers', label: 'Customers' },
      { href: '/docs', label: 'Documentation' },
      { href: '/docs/api-reference', label: 'API reference' },
    ],
  },
  {
    label: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: 'https://github.com/StrimzLab/strimz', label: 'GitHub' },
    ],
  },
  {
    label: 'Legal',
    links: [
      { href: '/legal/terms', label: 'Terms' },
      { href: '/legal/privacy', label: 'Privacy' },
      { href: '/legal/acceptable-use', label: 'Acceptable use' },
    ],
  },
] as const

export function MarketingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-24 bg-[#050020] text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Logo variant="mono-light" />
          <p className="mt-4 max-w-xs text-sm text-white/60">
            Stablecoin billing infrastructure. One API for everything you'd ever build on top of
            USDC.
          </p>
          <div className="mt-6 flex items-center gap-4 text-white/60">
            <Link href="https://x.com/Strimz_HQ" target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
              <FaXTwitter className="size-5" />
            </Link>
            <Link href="https://www.linkedin.com/company/strimzhq/" target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
              <FaLinkedin className="size-5" />
            </Link>
            <Link href="https://github.com/StrimzLab/strimz" target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
              <FaGithub className="size-5" />
            </Link>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.label}>
            <div className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/50">
              {col.label}
            </div>
            <ul className="space-y-3 text-sm text-white/70">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:px-6">
          <p>Made with care by the Strimz team · © {year} StrimzLab</p>
          <p>Built on Arc · USDC native</p>
        </div>
      </div>
    </footer>
  )
}
