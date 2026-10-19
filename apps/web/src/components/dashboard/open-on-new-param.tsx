'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { shouldOpenNew } from '@/lib/first-run'

function Watcher({ onOpen }: { onOpen: () => void }) {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!shouldOpenNew(params)) return
    onOpen()
    // Drop the flag so a refresh or Back doesn't reopen the dialog.
    router.replace(pathname, { scroll: false })
  }, [params, pathname, router, onOpen])

  return null
}

/** Opens a "new" dialog when the page is reached with ?new=1. */
export function OpenOnNewParam({ onOpen }: { onOpen: () => void }) {
  return (
    <Suspense fallback={null}>
      <Watcher onOpen={onOpen} />
    </Suspense>
  )
}
