'use client'

import { Store } from 'lucide-react'
import { Button, Card, CardContent, Input, Label } from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'

export default function StorefrontPage() {
  return (
    <>
      <PageHeader
        title="Your storefront"
        description="A hosted page at strimz.io/store/your-slug your customers can browse. Public; no auth required."
        action={<Button>Publish</Button>}
      />
      <Card className="max-w-3xl border-border/60">
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">Slug</Label>
              <Input placeholder="acme" />
              <p className="mt-1 text-xs text-muted-foreground">strimz.io/store/<strong>acme</strong></p>
            </div>
            <div>
              <Label className="mb-1.5 block">Display name</Label>
              <Input placeholder="Acme Inc." />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Description</Label>
            <Input placeholder="Quality widgets at scale." />
          </div>
          <div>
            <Label className="mb-1.5 block">Accent colour</Label>
            <Input placeholder="#02C76A" />
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
            <Store className="size-4 text-[#02C76A]" />
            Add products from the next tab. Each product becomes a one-shot or subscription
            checkout.
          </div>
        </CardContent>
      </Card>
    </>
  )
}
