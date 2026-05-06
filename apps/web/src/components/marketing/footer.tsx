import Link from 'next/link'
import { FaXTwitter, FaLinkedin, FaGithub } from 'react-icons/fa6'
import { Logo } from '@/components/shared/logo'
import { PaddedLines } from '@/components/shared/padded-lines'

const COLUMNS = [
  {
    label: 'Product',
    links: [
      { href: '/pricing', label: 'Pricing' },
      { href: '/customers', label: 'Customers' },
      { href: '/docs', label: 'Documentation' },
      { href: '/docs/api/overview', label: 'API reference' },
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
      { href: '/legal/terms', label: 'Terms of Service' },
      { href: '/legal/privacy', label: 'Privacy Policy' },
      { href: '/legal/acceptable-use', label: 'Acceptable use' },
    ],
  },
] as const

export function MarketingFooter() {
  const year = new Date().getFullYear()
  return (
    <>
      <footer className="flex w-full flex-col bg-[#050020] px-4 pt-12 pb-10 md:px-12 lg:px-20 lg:pt-20">
        <section className="flex w-full flex-col items-start justify-between gap-12 border-b border-[#58556A] pb-10 md:flex-row md:gap-0">
          <div className="max-w-xs">
            <Logo variant="white" className="lg:w-[126.98px]" />
            <p className="mt-5 font-poppins text-sm text-[#D1D5DB]">
              Stablecoin billing for businesses. One API for one-time payments, subscriptions, and
              agent-driven escrow. Settled in USDC on Arc.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <Link
                href="https://x.com/Strimz_HQ"
                target="_blank"
                className="text-[#D1D5DB] transition hover:text-white"
              >
                <FaXTwitter className="size-5" />
              </Link>
              <Link
                href="https://www.linkedin.com/company/strimzhq/"
                target="_blank"
                className="text-[#D1D5DB] transition hover:text-white"
              >
                <FaLinkedin className="size-5" />
              </Link>
              <Link
                href="https://github.com/StrimzLab/strimz"
                target="_blank"
                className="text-[#D1D5DB] transition hover:text-white"
              >
                <FaGithub className="size-5" />
              </Link>
            </div>
          </div>

          <div className="grid w-full max-w-2xl grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.label}>
                <div className="mb-4 font-sora text-sm font-[600] uppercase tracking-wide text-white">
                  {col.label}
                </div>
                <ul className="space-y-3 font-poppins text-sm text-[#D1D5DB]">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="transition hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="flex w-full flex-col items-center justify-between gap-4 pt-6 md:flex-row md:gap-0">
          <p className="font-poppins text-sm text-[#D1D5DB] md:text-base">
            Made with 💚 by the Strimz team
          </p>
          <p className="font-poppins text-sm text-[#D1D5DB] md:text-base">
            © {year} Strimz. All rights reserved.
          </p>
        </section>
      </footer>
      <PaddedLines />
    </>
  )
}
