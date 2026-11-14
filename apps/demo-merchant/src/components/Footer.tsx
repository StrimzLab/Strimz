import Link from 'next/link'
import { FanlineMark } from './Icons'

export function Footer() {
  return (
    <footer className="border-t border-[hsl(var(--border))]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FanlineMark className="h-6 w-6" />
          <span className="font-display text-lg font-bold tracking-tight">fanline</span>
        </div>
        <p className="muted max-w-md text-sm leading-6">
          Fanline is a demo creator platform built on{' '}
          <a
            href="https://strimz.finance"
            className="text-ink font-medium underline-offset-4 hover:underline"
          >
            Strimz
          </a>
          . It runs on testnet, so every tip and subscription uses test USDC.{' '}
          <a
            href="https://docs.strimz.finance/docs"
            className="text-ink font-medium underline-offset-4 hover:underline"
          >
            See how it&rsquo;s built
          </a>
          .
        </p>
        <ul className="muted flex gap-6 text-sm">
          <li>
            <Link href="/#creators" className="hover:text-ink">
              Creators
            </Link>
          </li>
          <li>
            <Link href="/#pro" className="hover:text-ink">
              Pro
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  )
}
