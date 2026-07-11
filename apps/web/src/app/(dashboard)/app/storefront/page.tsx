'use client'

import * as React from 'react'
import { Plus, ExternalLink, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Badge,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  FieldLabel,
  Label,
  Textarea,
} from '@strimz/ui'
import { parseUnits } from 'viem'
import type {
  PaymentCurrency,
  Storefront,
  StorefrontProduct,
  StorefrontProductType,
} from '@strimz/shared-types'

import { ImageUpload } from '@/components/dashboard/image-upload'
import { PageHeader } from '@/components/dashboard/page-header'
import { TokenLogo } from '@/components/shared/token-logo'
import { formatTokenAmount } from '@/lib/format'
import {
  useAddStorefrontProduct,
  useArchiveStorefront,
  useArchiveStorefrontProduct,
  usePublishStorefront,
  useStorefront,
  useStorefrontProducts,
  useUpsertStorefront,
} from '@/hooks/api'

export default function StorefrontPage() {
  const storefrontQuery = useStorefront()
  const storefront = storefrontQuery.data ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storefront"
        docsSlug="storefront"
        description="A hosted page where customers can buy from you without an integration. One URL, your products listed, USDC payment on Arc."
        action={
          storefront ? (
            <Button variant="outline" asChild>
              <a
                href={`https://strimz.finance/store/${storefront.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="mr-1.5 size-4" /> View live
              </a>
            </Button>
          ) : null
        }
      />

      {storefrontQuery.isLoading ? (
        <div className="border-border/60 bg-muted/30 h-32 animate-pulse rounded-xl border" />
      ) : !storefront ? (
        <NoStorefront />
      ) : (
        <StorefrontDetails storefront={storefront} />
      )}
    </div>
  )
}

/**
 * No storefront yet. Show the create flow inline. The first storefront
 * doubles as the configuration step, so this card is the merchant's
 * onboarding into the feature.
 */
function NoStorefront() {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-6 text-center">
        <h3 className="font-sora text-base font-semibold">No storefront yet</h3>
        <p className="text-muted-foreground mx-auto max-w-md text-xs">
          Create one to get a public URL. Your customers browse and pay without ever needing your
          app integrated. Useful for digital downloads, services, or curated subscriptions.
        </p>
        <UpsertStorefrontDialog
          trigger={
            <Button size="sm">
              <Plus className="mr-1.5 size-4" /> Create storefront
            </Button>
          }
        />
      </CardContent>
    </Card>
  )
}

function StorefrontDetails({ storefront }: { storefront: Storefront }) {
  const publishMutation = usePublishStorefront()
  const archiveMutation = useArchiveStorefront()

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-sora text-base font-semibold">{storefront.name}</h3>
                <Badge
                  variant="outline"
                  className={
                    storefront.status === 'published'
                      ? 'border-[#02C76A]/40 bg-[#02C76A]/10 text-[10px] text-[#02C76A]'
                      : 'text-[10px]'
                  }
                >
                  {storefront.status}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {storefront.description ?? 'No description set.'}
              </p>
              <code className="text-muted-foreground mt-2 inline-block text-xs">
                strimz.finance/store/{storefront.slug}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <UpsertStorefrontDialog
                existing={storefront}
                trigger={
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                }
              />
              {storefront.status === 'draft' || storefront.status === 'archived' ? (
                <Button
                  size="sm"
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                >
                  {publishMutation.isPending ? 'Publishing…' : 'Publish'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                >
                  Archive
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ProductsSection />
    </div>
  )
}

function ProductsSection() {
  const productsQuery = useStorefrontProducts({ limit: 50 })
  const archiveProductMutation = useArchiveStorefrontProduct()

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-sora text-base font-semibold">Products</h3>
          <p className="text-muted-foreground text-xs">
            Each product becomes a buy-now button on your storefront URL.
          </p>
        </div>
        <AddProductDialog />
      </div>

      {productsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-border/60 bg-muted/30 h-40 animate-pulse rounded-xl border"
            />
          ))}
        </div>
      ) : !productsQuery.data || productsQuery.data.data.length === 0 ? (
        <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed p-8 text-center text-xs">
          No products yet. Add one to start selling.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {productsQuery.data.data.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onArchive={() => archiveProductMutation.mutate(product.id)}
              isArchiving={archiveProductMutation.isPending}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ProductCard({
  product,
  onArchive,
  isArchiving,
}: {
  product: StorefrontProduct
  onArchive: () => void
  isArchiving: boolean
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">{product.name}</h4>
              <Badge variant="outline" className="text-[10px] capitalize">
                {product.type.replace('_', ' ')}
              </Badge>
            </div>
            {product.description ? (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                {product.description}
              </p>
            ) : null}
          </div>
          {!product.isActive ? (
            <Badge variant="outline" className="text-[10px] text-rose-600">
              Archived
            </Badge>
          ) : null}
        </div>
        <div className="font-sora flex items-center gap-1.5 text-lg font-semibold">
          <TokenLogo symbol={product.currency} size={18} />
          {formatTokenAmount(product.price, product.currency)}
          {product.type === 'subscription' && product.interval ? (
            <span className="text-muted-foreground text-xs">/{product.interval}</span>
          ) : null}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {product.stock === null ? 'Unlimited' : `${product.stock} in stock`}
          </span>
          {product.isActive ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-600"
              onClick={onArchive}
              disabled={isArchiving}
            >
              <Trash2 className="mr-1 size-3" /> Archive
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Upsert dialog covers both create (no `existing`) and edit (with one).
 * Slug is locked on edit because the public URL is baked into wherever
 * the merchant has already shared it.
 */
function UpsertStorefrontDialog({
  existing,
  trigger,
}: {
  existing?: Storefront
  trigger: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [slug, setSlug] = React.useState(existing?.slug ?? '')
  const [name, setName] = React.useState(existing?.name ?? '')
  const [description, setDescription] = React.useState<string>(existing?.description ?? '')
  const [logoUrl, setLogoUrl] = React.useState<string | null>(existing?.logoUrl ?? null)
  const [coverImageUrl, setCoverImageUrl] = React.useState<string | null>(
    existing?.coverImageUrl ?? null,
  )

  const upsertMutation = useUpsertStorefront()

  const reset = () => {
    setSlug(existing?.slug ?? '')
    setName(existing?.name ?? '')
    setDescription(existing?.description ?? '')
    setLogoUrl(existing?.logoUrl ?? null)
    setCoverImageUrl(existing?.coverImageUrl ?? null)
  }

  const onSubmit = () => {
    if (!slug || !name) return
    upsertMutation.mutate(
      {
        slug,
        name,
        description: description || null,
        logoUrl,
        coverImageUrl,
        accentColor: existing?.accentColor ?? null,
        socialLinks: existing?.socialLinks ?? [],
      },
      { onSuccess: () => setOpen(false) },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit storefront' : 'Create storefront'}</DialogTitle>
          <DialogDescription>
            Your public URL will be{' '}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">
              strimz.finance/store/<strong>{slug || 'your-slug'}</strong>
            </code>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="sf-slug" required>
              URL slug
            </FieldLabel>
            <Input
              id="sf-slug"
              placeholder="acme-pro"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              disabled={!!existing}
            />
          </div>
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="sf-name" required>
              Storefront name
            </FieldLabel>
            <Input
              id="sf-name"
              placeholder="Acme. Pro"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="sf-desc" required={false}>
              Description
            </FieldLabel>
            <Textarea
              id="sf-desc"
              placeholder="Short pitch shown on the storefront."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ImageUpload
              endpoint="storefrontLogo"
              value={logoUrl}
              onChange={setLogoUrl}
              label="Logo"
              aspect="square"
              maxSizeLabel="2MB"
              alt="Storefront logo"
            />
            <ImageUpload
              endpoint="storefrontCover"
              value={coverImageUrl}
              onChange={setCoverImageUrl}
              label="Cover image"
              aspect="wide"
              maxSizeLabel="4MB"
              alt="Storefront cover"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={upsertMutation.isPending || !slug || !name}>
            {upsertMutation.isPending ? 'Saving…' : existing ? 'Save changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddProductDialog() {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [price, setPrice] = React.useState('')
  const [type, setType] = React.useState<StorefrontProductType>('one_time')
  const [stock, setStock] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)

  const addMutation = useAddStorefrontProduct()

  const reset = () => {
    setName('')
    setDescription('')
    setPrice('')
    setType('one_time')
    setStock('')
    setImageUrl(null)
  }

  const onSubmit = () => {
    if (!name || !price) return
    let raw: string
    try {
      raw = parseUnits(price, 6).toString()
    } catch {
      toast.error('Enter a valid price')
      return
    }
    addMutation.mutate(
      {
        name,
        description: description || null,
        // Optional field on the create schema. Send only when set so a
        // blank string doesn't fail the url() validator.
        ...(imageUrl ? { imageUrl } : {}),
        price: raw,
        currency: 'USDC' as PaymentCurrency,
        type,
        interval: type === 'subscription' ? 'monthly' : null,
        intervalCount: type === 'subscription' ? 1 : null,
        stock: stock ? Math.max(0, Number(stock) || 0) : null,
        isActive: true,
        sortOrder: 0,
      },
      {
        onSuccess: () => {
          setOpen(false)
          reset()
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" /> Add product
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
          <DialogDescription>
            The product appears as a buy-now button on your storefront.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="p-name" required>
              Name
            </FieldLabel>
            <Input
              id="p-name"
              placeholder="Annual licence"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="p-desc" required={false}>
              Description
            </FieldLabel>
            <Textarea
              id="p-desc"
              placeholder="Short line, max 2000 chars."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="p-price" required>
                Price (USDC)
              </FieldLabel>
              <Input
                id="p-price"
                type="number"
                step="0.01"
                placeholder="99.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="p-stock" required={false}>
                Stock
              </FieldLabel>
              <Input
                id="p-stock"
                type="number"
                placeholder="Unlimited"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Label>Type:</Label>
            {(['one_time', 'subscription'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={[
                  'h-7 rounded-md border px-2 capitalize transition-colors',
                  type === t
                    ? 'border-[#02C76A] bg-[#02C76A]/10 text-[#02C76A]'
                    : 'border-border/60 hover:bg-muted',
                ].join(' ')}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
          <ImageUpload
            endpoint="productImage"
            value={imageUrl}
            onChange={setImageUrl}
            label="Product image"
            aspect="square"
            maxSizeLabel="4MB"
            alt="Product image"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={addMutation.isPending || !name || !price}>
            {addMutation.isPending ? 'Adding…' : 'Add product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
