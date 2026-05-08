import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Storefront',
  description: 'Configure your hosted storefront — branding, products, and checkout behaviour.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
