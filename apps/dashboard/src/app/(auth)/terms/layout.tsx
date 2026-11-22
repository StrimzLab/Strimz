import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Updated terms',
  description: 'Accept the current Strimz Terms of Service.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
