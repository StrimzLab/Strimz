import { Lock } from 'lucide-react'
import type { PlanFeature } from '@strimz/shared-config'

import { planLockedNotice } from '@/lib/pricing-plans'

export function PlanLockedNotice({ feature }: { feature: PlanFeature }) {
  const { title, body } = planLockedNotice(feature)
  return (
    <div className="border-border/60 bg-muted/30 flex items-start gap-3 rounded-md border border-dashed p-4">
      <Lock className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <p className="text-muted-foreground mt-1 text-xs">{body}</p>
      </div>
    </div>
  )
}
