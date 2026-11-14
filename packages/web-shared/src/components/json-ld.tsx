import { jsonLdScript } from '../lib/structured-data'

export function JsonLd({ data }: { data: Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(...data) }}
    />
  )
}
