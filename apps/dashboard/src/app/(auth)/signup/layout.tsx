import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Sign up for a Strimz merchant account in about two minutes.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
