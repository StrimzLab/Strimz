import Link from 'next/link'
import { Glyph } from '@/components/shared/logo'

/**
 * Quiet footer for the dashboard. Sits at the bottom of the
 * `DashboardShell` main content scroll area. Plain inline links — no
 * heavy footer, just enough to find docs/status/legal.
 */
export function DashboardFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-12 border-t border-[#E5E7EB] bg-white">
      <div className="font-poppins mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-3 px-1 py-5 text-[12px] text-[#58556A] sm:flex-row sm:items-center sm:px-2">
        <div className="flex items-center gap-2">
          <Glyph className="size-4" />
          <span>© {year} Strimz Labs</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[#050020]"
          >
            Documentation
          </Link>
          <a
            href="https://status.strimz.finance"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-[#050020]"
          >
            <span className="size-1.5 rounded-full bg-[#02C76A]" />
            All systems normal
          </a>
          <Link
            href="/legal/terms"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[#050020]"
          >
            Terms
          </Link>
          <Link
            href="/legal/privacy"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[#050020]"
          >
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  )
}
