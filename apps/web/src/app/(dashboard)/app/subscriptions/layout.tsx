import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Subscriptions',
  description: 'Recurring billing — active, at-risk, and lapsed subscriptions across plans.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
