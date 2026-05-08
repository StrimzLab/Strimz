import type { Metadata } from 'next'

/**
 * Default metadata for `/app` (the overview / home of the merchant
 * dashboard). Sub-routes under `/app/*` override this via their own
 * sibling layout.tsx — child segment metadata wins.
 */
export const metadata: Metadata = {
  title: 'Overview',
  description: 'Recent payments, subscriptions, and merchant activity.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
