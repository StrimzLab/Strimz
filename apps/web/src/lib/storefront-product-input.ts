import { parseUnits } from 'viem'
import type {
  CreateStorefrontProductInput,
  StorefrontProductType,
  SubscriptionPlan,
} from '@strimz/shared-types'

export interface ProductFormState {
  name: string
  description: string
  imageUrl: string | null
  price: string
  type: StorefrontProductType
  stock: string
  plan: SubscriptionPlan | null
}

export type ProductFormResult =
  | { ok: true; input: CreateStorefrontProductInput }
  | { ok: false; reason: 'incomplete' | 'invalid_price' }

export function buildProductInput(form: ProductFormState): ProductFormResult {
  if (!form.name) return { ok: false, reason: 'incomplete' }
  if (form.type === 'subscription' && !form.plan) return { ok: false, reason: 'incomplete' }

  let price: string
  if (form.plan) {
    price = form.plan.amount
  } else {
    if (!form.price) return { ok: false, reason: 'incomplete' }
    try {
      price = parseUnits(form.price, 6).toString()
    } catch {
      return { ok: false, reason: 'invalid_price' }
    }
  }

  return {
    ok: true,
    input: {
      name: form.name,
      description: form.description || null,
      ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
      price,
      currency: form.plan ? form.plan.currency : 'USDC',
      type: form.type,
      interval: form.plan ? form.plan.interval : null,
      intervalCount: form.plan ? form.plan.intervalCount : null,
      ...(form.plan ? { planId: form.plan.id } : {}),
      stock: form.stock ? Math.max(0, Number(form.stock) || 0) : null,
      isActive: true,
      sortOrder: 0,
    },
  }
}
