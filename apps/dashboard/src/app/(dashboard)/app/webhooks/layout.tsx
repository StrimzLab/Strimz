import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Webhooks',
  description: 'Endpoint configuration, signing secrets, recent deliveries, and retry status.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
