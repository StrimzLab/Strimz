import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Sign in · Strimz Admin',
  robots: { index: false, follow: false },
}

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  return children
}
