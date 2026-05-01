import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source } from '@/lib/source'
import 'fumadocs-ui/style.css'

export default function DocsRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: (
          <span className="inline-flex items-center gap-2 font-semibold">
            <span className="inline-block size-5 rounded-md bg-[#02C76A]" />
            Strimz
          </span>
        ),
        url: '/',
      }}
      links={[
        { text: 'Dashboard', url: '/app' },
        { text: 'Pricing', url: '/pricing' },
      ]}
    >
      {children}
    </DocsLayout>
  )
}
