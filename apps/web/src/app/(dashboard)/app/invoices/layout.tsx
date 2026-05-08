import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Invoices',
  description: 'Invoices issued to your customers, draft to paid.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
