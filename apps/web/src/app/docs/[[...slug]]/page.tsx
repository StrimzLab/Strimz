import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page'
import { source } from '@/lib/source'
import { getMDXComponents } from '@/components/mdx-components'

export default async function DocsCatchAllPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  // page.data shape is sourced from fumadocs-mdx's generated types,
  // which only exist after `next dev` / `next build` has run once.
  // Cast through `unknown` to keep `pnpm typecheck` green pre-build.
  const data = page.data as unknown as {
    title: string
    description?: string
    full?: boolean
    toc: ReturnType<typeof getMDXComponents> extends infer _ ? unknown : never
    body: React.ComponentType<{ components?: ReturnType<typeof getMDXComponents> }>
  }
  const MDX = data.body
  return (
    <DocsPage toc={data.toc as never} full={data.full}>
      <DocsTitle>{data.title}</DocsTitle>
      <DocsDescription>{data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) return {}
  const data = page.data as unknown as { title: string; description?: string }
  return {
    title: data.title,
    description: data.description,
  }
}
