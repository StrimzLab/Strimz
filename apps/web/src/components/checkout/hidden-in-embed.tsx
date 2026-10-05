'use client'

import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { EMBED_QUERY_PARAM, isEmbedded } from '@/lib/theme'

export function HiddenInEmbed({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  if (isEmbedded(searchParams.get(EMBED_QUERY_PARAM))) return null
  return <>{children}</>
}
