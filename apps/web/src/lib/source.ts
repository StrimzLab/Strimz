import { docs } from '@/.source'
import { loader } from 'fumadocs-core/source'

/** Fumadocs source loader. Backs the docs router. */
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
})
