import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { RootProvider } from 'fumadocs-ui/provider'
import { source } from '@/lib/source'
import { baseOptions } from '@/lib/layout.shared'
import 'fumadocs-ui/style.css'
import '@/styles/docs.css'

export default function DocsRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootProvider theme={{ enabled: false }}>
      <DocsLayout tree={source.pageTree} {...baseOptions()}>
        {children}
      </DocsLayout>
    </RootProvider>
  )
}
