'use client'

import type { StrimzBrowserClient } from '@strimz/sdk/browser'
import { useStrimzContext } from '../provider.js'

/** Read the singleton browser client out of context. */
export function useStrimzClient(): StrimzBrowserClient {
  return useStrimzContext().client
}
