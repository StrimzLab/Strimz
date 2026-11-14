import { daysAgo, id } from './_seed'

export type StorefrontStatus = 'draft' | 'published' | 'archived'

export type Storefront = {
  id: string
  slug: string
  name: string
  description: string
  accentColor: string
  logoUrl: string | null
  coverImageUrl: string | null
  socialLinks: string[]
  status: StorefrontStatus
  publishedAt: string | null
}

export const STOREFRONT: Storefront = {
  id: id('store', 1),
  slug: 'acme',
  name: 'Acme Inc.',
  description: 'Premium widgets settled in USDC. Free shipping over $100.',
  accentColor: '#02C76A',
  logoUrl: null,
  coverImageUrl: null,
  socialLinks: ['https://x.com/acme', 'https://acme.io'],
  status: 'published',
  publishedAt: daysAgo(45),
}

export type ProductType = 'one_time' | 'subscription'
export type ProductStatus = 'active' | 'archived'

export type StorefrontProduct = {
  id: string
  name: string
  description: string
  priceUsdc: number
  currency: 'USDC'
  type: ProductType
  status: ProductStatus
  imageUrl: string | null
  stock: number | null
  interval?: 'monthly' | 'yearly' | 'weekly'
  intervalCount?: number
  sales30d: number
  revenue30dUsdc: number
}

export const STOREFRONT_PRODUCTS: StorefrontProduct[] = [
  {
    id: id('prod', 1),
    name: 'Pro Widget',
    description: 'Our flagship widget. Free shipping.',
    priceUsdc: 50_000_000,
    currency: 'USDC',
    type: 'one_time',
    status: 'active',
    imageUrl: null,
    stock: 124,
    sales30d: 38,
    revenue30dUsdc: 1_900_000_000,
  },
  {
    id: id('prod', 2),
    name: 'Widget bundle (3-pack)',
    description: 'Three widgets at a discount.',
    priceUsdc: 130_000_000,
    currency: 'USDC',
    type: 'one_time',
    status: 'active',
    imageUrl: null,
    stock: 41,
    sales30d: 17,
    revenue30dUsdc: 2_210_000_000,
  },
  {
    id: id('prod', 3),
    name: 'Pro Subscription',
    description: 'Monthly Pro plan. Cancel anytime.',
    priceUsdc: 20_000_000,
    currency: 'USDC',
    type: 'subscription',
    status: 'active',
    imageUrl: null,
    stock: null,
    interval: 'monthly',
    intervalCount: 1,
    sales30d: 22,
    revenue30dUsdc: 440_000_000,
  },
  {
    id: id('prod', 4),
    name: 'Annual Pro',
    description: 'Save 20% with annual billing.',
    priceUsdc: 192_000_000,
    currency: 'USDC',
    type: 'subscription',
    status: 'active',
    imageUrl: null,
    stock: null,
    interval: 'yearly',
    intervalCount: 1,
    sales30d: 4,
    revenue30dUsdc: 768_000_000,
  },
  {
    id: id('prod', 5),
    name: 'Limited edition T-shirt',
    description: 'Only 100 made.',
    priceUsdc: 25_000_000,
    currency: 'USDC',
    type: 'one_time',
    status: 'archived',
    imageUrl: null,
    stock: 0,
    sales30d: 0,
    revenue30dUsdc: 0,
  },
]
