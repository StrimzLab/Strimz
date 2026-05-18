'use client'

import * as React from 'react'
import { ExternalLink, MoreHorizontal, Plus, Globe, Eye } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Button,
  Badge,
  Card,
  CardContent,
  Input,
  Label,
  Switch,
  Textarea,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { STOREFRONT, STOREFRONT_PRODUCTS, type StorefrontProduct } from '@/data/storefront'
import { formatUsdc } from '@/data/_seed'

export default function StorefrontPage() {
  const [published, setPublished] = React.useState(STOREFRONT.status === 'published')
  const totalRevenue30d = STOREFRONT_PRODUCTS.reduce((s, p) => s + p.revenue30dUsdc, 0)
  const totalSales30d = STOREFRONT_PRODUCTS.reduce((s, p) => s + p.sales30d, 0)

  const productCols: ColumnDef<StorefrontProduct>[] = React.useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Product',
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-muted-foreground text-xs">{row.original.description}</span>
          </div>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) =>
          row.original.type === 'subscription' ? (
            <Badge variant="outline" className="text-[10px]">
              {row.original.interval ?? 'subscription'}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              one-time
            </Badge>
          ),
      },
      {
        accessorKey: 'priceUsdc',
        header: 'Price',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-mono">
            <TokenLogo symbol="USDC" size={14} />
            {formatUsdc(row.original.priceUsdc)}
          </span>
        ),
      },
      {
        accessorKey: 'sales30d',
        header: 'Sales (30d)',
        cell: ({ row }) => <span>{row.original.sales30d}</span>,
      },
      {
        accessorKey: 'revenue30dUsdc',
        header: 'Revenue (30d)',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-mono">
            <TokenLogo symbol="USDC" size={14} />
            {formatUsdc(row.original.revenue30dUsdc)}
          </span>
        ),
      },
      {
        accessorKey: 'stock',
        header: 'Stock',
        cell: ({ row }) =>
          row.original.stock === null ? (
            <span className="text-muted-foreground text-xs">∞</span>
          ) : (
            <span className={row.original.stock < 10 ? 'font-medium text-amber-600' : ''}>
              {row.original.stock}
            </span>
          ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.status === 'active' ? (
            <StatusPill tone="positive">active</StatusPill>
          ) : (
            <StatusPill tone="neutral">archived</StatusPill>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="size-8 p-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{row.original.name}</DropdownMenuLabel>
              <DropdownMenuItem>
                <Eye className="mr-2 size-4" /> View on storefront
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success('Edit dialog (mock)')}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-600 focus:text-rose-600"
                onClick={() => toast.success(`${row.original.name} archived`)}
              >
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storefront"
        description="Your hosted, branded landing page. Updates we ship (better mobile layouts, faster image opt) automatically benefit your store."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/store/${STOREFRONT.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 size-4" /> View live
              </a>
            </Button>
            <NewProductDialog />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Sales (30d)" value={totalSales30d.toLocaleString()} />
        <Stat label="Revenue (30d)" value={`${formatUsdc(totalRevenue30d)} USDC`} />
        <Stat
          label="Active products"
          value={STOREFRONT_PRODUCTS.filter((p) => p.status === 'active').length.toString()}
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="shadow-sub-card border-border/60">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-[#02C76A]" />
              <h3 className="font-sora text-base font-semibold">Storefront details</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">strimz.finance/store/</span>
                  <Input defaultValue={STOREFRONT.slug} className="h-9" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Display name</Label>
                <Input defaultValue={STOREFRONT.name} className="h-9" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Textarea defaultValue={STOREFRONT.description} rows={2} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Accent color</Label>
                <div className="flex items-center gap-2">
                  <div
                    className="border-border/60 size-9 rounded-md border"
                    style={{ backgroundColor: STOREFRONT.accentColor }}
                  />
                  <Input defaultValue={STOREFRONT.accentColor} className="h-9 font-mono text-xs" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Logo URL</Label>
                <Input
                  defaultValue={STOREFRONT.logoUrl ?? ''}
                  placeholder="https://…/logo.png"
                  className="h-9"
                />
              </div>
            </div>

            <Button variant="default" onClick={() => toast.success('Storefront updated')}>
              Save changes
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sub-card border-border/60">
          <CardContent className="space-y-4 p-6">
            <h3 className="font-sora text-base font-semibold">Publishing</h3>
            <div className="border-border/40 flex items-center justify-between rounded-md border p-3">
              <div className="text-sm">
                <div className="font-medium">{published ? 'Published' : 'Draft'}</div>
                <div className="text-muted-foreground text-xs">
                  {published ? 'Your storefront is live' : 'Only you can see this'}
                </div>
              </div>
              <Switch
                checked={published}
                onCheckedChange={(v) => {
                  setPublished(v)
                  toast.success(v ? 'Published' : 'Set to draft')
                }}
              />
            </div>
            <div className="text-muted-foreground text-xs">
              Custom domains (`shop.your-site.com`) are available on Growth and above.
            </div>
            <Button variant="outline" className="w-full">
              Configure custom domain
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="font-sora text-base font-semibold">Products</h2>
        <DataTable
          columns={productCols}
          data={STOREFRONT_PRODUCTS}
          searchPlaceholder="Search products…"
          emptyTitle="No products yet"
          emptyDescription="Add your first product to start selling on your storefront."
        />
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="shadow-sub-card border-border/60 bg-background rounded-xl border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-sora mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function NewProductDialog() {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Plus className="mr-1.5 size-4" /> New product
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
          <DialogDescription>
            Pick one-time or subscription. Strimz creates the backing plan automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="prod-name">Name</Label>
            <Input id="prod-name" placeholder="Pro Widget" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="prod-desc">Description</Label>
            <Textarea id="prod-desc" rows={2} placeholder="Our flagship widget." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="prod-price">Price (USDC)</Label>
              <Input id="prod-price" type="number" step="0.01" placeholder="50.00" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prod-type">Type</Label>
              <Select defaultValue="one_time">
                <SelectTrigger id="prod-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setOpen(false)
              toast.success('Product added (mock)')
            }}
          >
            Add product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
