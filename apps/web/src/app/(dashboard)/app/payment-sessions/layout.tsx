import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payment sessions',
  description: 'One-shot stablecoin payment sessions, by status and time window.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
