import { z } from 'zod'

const url = z.string().url()

/** `ARC_FALLBACK_RPC_URLS`: comma-separated, tried in order after `ARC_RPC_URL`. */
export function parseFallbackRpcUrls(raw: string | undefined): string[] {
  const entries = (raw ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
  for (const entry of entries) {
    if (!url.safeParse(entry).success) {
      throw new Error('ARC_FALLBACK_RPC_URLS must be a comma-separated list of URLs')
    }
  }
  return entries
}
