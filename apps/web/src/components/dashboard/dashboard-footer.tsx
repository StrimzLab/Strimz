import Link from 'next/link'
import { Glyph } from '@/components/shared/logo'

/**
 * Quiet footer for the dashboard. Sits at the bottom of the
 * `DashboardShell` main content scroll area. Plain inline links. No
 * heavy footer, just enough to find docs/status/legal.
 */
export function DashboardFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-border bg-background mt-12 border-t">
      <div className="font-poppins text-muted-foreground mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-3 px-1 py-5 text-[12px] sm:flex-row sm:items-center sm:px-2">
        <div className="flex items-center gap-2">
          <Glyph className="size-4" />
          <span>© {year} Strimz Labs</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Documentation
          </Link>
          <a
            href="https://status.strimz.finance"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <span className="bg-accent size-1.5 rounded-full" />
            All systems normal
          </a>
          <Link
            href="/legal/terms"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Terms
          </Link>
          <Link
            href="/legal/privacy"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  )
}
