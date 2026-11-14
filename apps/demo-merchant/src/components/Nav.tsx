import Link from 'next/link'
import { ThemeToggle } from './ThemeToggle'
import { FanlineMark } from './Icons'

const LINKS = [
  { href: '/#creators', label: 'Creators' },
  { href: '/#how', label: 'How it works' },
  { href: '/#pro', label: 'Pro' },
]

export function Nav() {
  return (
    <header className="bg-paper/80 sticky top-0 z-40 border-b border-[hsl(var(--border))] backdrop-blur">
      <p className="bg-ink text-paper px-6 py-2 text-center text-xs">
        A live demo of Strimz on testnet. Payments use test USDC, not real money.
      </p>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Fanline home">
          <FanlineMark className="h-7 w-7" />
          <span className="font-display text-xl font-bold tracking-tight">fanline</span>
        </Link>
        <ul className="hidden items-center gap-8 text-sm font-medium sm:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="muted hover:text-ink transition">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <Link href="/#tip" className="btn btn-primary hidden px-5 py-2 sm:inline-flex">
            Send a tip
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
