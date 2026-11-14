import { source } from '@/lib/source'
import { createFromSource } from 'fumadocs-core/search/server'

/**
 * Orama-backed search endpoint, consumed by Fumadocs UI's command palette.
 * Indexes every doc page at build time; no client-side index download.
 */
export const { GET } = createFromSource(source)
