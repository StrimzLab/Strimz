import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * Shared chrome for the marketing legal pages — Terms, Privacy, AUP.
 * Provides consistent header, table of contents, last-updated stamp,
 * and side-rail of related documents.
 */
export function LegalDoc({
  title,
  description,
  lastUpdated,
  effectiveDate,
  toc,
  children,
}: {
  title: string
  description: string
  lastUpdated: string
  effectiveDate: string
  toc: { id: string; label: string }[]
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <header className="border-b border-border/40 pb-8">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Legal</div>
        <h1 className="font-poppins text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span><span className="font-medium text-foreground">Effective:</span> {effectiveDate}</span>
          <span className="opacity-40">·</span>
          <span><span className="font-medium text-foreground">Last updated:</span> {lastUpdated}</span>
        </div>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_220px]">
        <article className="prose prose-neutral max-w-none prose-h2:scroll-mt-24 prose-h2:font-poppins prose-h2:text-2xl prose-h2:font-semibold prose-h3:font-poppins prose-a:text-[#02C76A] prose-a:no-underline hover:prose-a:underline">
          {children}

          <hr className="my-12 border-border/40" />
          <p className="text-sm text-muted-foreground">
            Questions about this document? Email{' '}
            <a href="mailto:legal@strimz.finance">legal@strimz.finance</a>.
          </p>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6 text-sm">
            <div>
              <div className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">On this page</div>
              <ul className="space-y-1.5 border-l border-border/40 pl-3">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a className="text-muted-foreground transition-colors hover:text-foreground" href={`#${t.id}`}>{t.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Related</div>
              <ul className="space-y-1.5">
                <li><Link href="/legal/terms" className="text-muted-foreground hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="/legal/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="/legal/acceptable-use" className="text-muted-foreground hover:text-foreground">Acceptable Use</Link></li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
