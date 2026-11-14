import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payment links',
  description: 'One-time payment links, by status and time window.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
