import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Accept admin invite · Strimz Admin',
  robots: { index: false, follow: false },
}

export default function AcceptInviteLayout({ children }: { children: ReactNode }) {
  return children
}
