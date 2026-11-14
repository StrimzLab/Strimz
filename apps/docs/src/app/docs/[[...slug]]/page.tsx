import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page'
import { source } from '@/lib/source'
import { getMDXComponents } from '@/components/mdx-components'
import { JsonLd } from '@strimz/web-shared/components/json-ld'
import { OG_IMAGE } from '@strimz/web-shared/lib/seo'
import { DOCS_ORIGIN, breadcrumbLd, techArticleLd } from '@strimz/web-shared/lib/structured-data'

function trail(slugs: string[]) {
  const crumbs = [{ name: 'Docs', url: `${DOCS_ORIGIN}/docs` }]
  slugs.forEach((_, i) => {
    const page = source.getPage(slugs.slice(0, i + 1))
    if (page) {
      const { title } = page.data as unknown as { title: string }
      crumbs.push({ name: title, url: `${DOCS_ORIGIN}${page.url}` })
    }
  })
  return crumbs
}

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
  const url = `${DOCS_ORIGIN}${page.url}`
  return (
    <DocsPage toc={data.toc as never} full={data.full}>
      <JsonLd
        data={[
          techArticleLd({ title: data.title, description: data.description, url }),
          breadcrumbLd(trail(page.slugs)),
        ]}
      />
      <DocsTitle>{data.title}</DocsTitle>
      <DocsDescription>{data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams() {
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
    alternates: { canonical: page.url },
    openGraph: {
      type: 'article',
      siteName: 'Strimz Docs',
      title: data.title,
      description: data.description,
      url: page.url,
      images: [OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title: data.title, description: data.description },
  }
}
