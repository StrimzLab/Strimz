import { COMPANIES, daysAgo, emailFor, fullName, id, mulberry32, pick, range, walletAddress } from './_seed'

export type Customer = {
  id: string
  walletAddress: string
  email: string | null
  name: string | null
  company: string | null
  totalSpentUsdc: number
  transactionCount: number
  activeSubscriptions: number
  createdAt: string
  lastSeenAt: string
}

const rng = mulberry32(42)

export const CUSTOMERS: Customer[] = range(48).map((i) => {
  const name = fullName(rng)
  const company = rng() > 0.4 ? pick(rng, COMPANIES) : null
  const txCount = Math.floor(rng() * 24) + 1
  return {
    id: id('cus', i + 1),
    walletAddress: walletAddress(rng),
    email: rng() > 0.2 ? emailFor(name, company ?? undefined) : null,
    name: rng() > 0.1 ? name : null,
    company,
    totalSpentUsdc: Math.floor(rng() * 8_000_000_000) + 200_000_000,
    transactionCount: txCount,
    activeSubscriptions: rng() > 0.5 ? Math.floor(rng() * 3) + 1 : 0,
    createdAt: daysAgo(Math.floor(rng() * 360) + 1),
    lastSeenAt: daysAgo(Math.floor(rng() * 30)),
  }
})

export function getCustomer(idOrAddress: string): Customer | undefined {
  return CUSTOMERS.find((c) => c.id === idOrAddress || c.walletAddress === idOrAddress)
}
