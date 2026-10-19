export interface CaseStudy {
  quote: string
  name: string | null
  role: string | null
  company: string | null
  sector: string
}

// Shown only once a real merchant has agreed to be named.
export const CASE_STUDIES: readonly CaseStudy[] = [
  {
    quote:
      "Our subscribers pay in USDC now, and the money lands in our own wallet the moment it settles. There's no payout schedule to wait on. Setting up the first plan was quicker than I expected.",
    name: null,
    role: null,
    company: null,
    sector: 'SaaS',
  },
  {
    quote:
      'Customers sign once and the monthly charge just happens. When a charge fails we get a webhook and they get an email asking them to top up. I stopped chasing people by hand.',
    name: null,
    role: null,
    company: null,
    sector: 'Subscriptions',
  },
  {
    quote:
      'The webhooks are signed, so our order system trusts them without us polling anything. And our customers never have to buy gas to pay us, which used to be the first question they asked.',
    name: null,
    role: null,
    company: null,
    sector: 'Marketplace',
  },
]

export function namedCaseStudies(studies: readonly CaseStudy[]): CaseStudy[] {
  return studies.filter((s) => s.name && s.role && s.company)
}
