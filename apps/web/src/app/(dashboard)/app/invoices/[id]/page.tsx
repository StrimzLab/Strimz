'use client'

import * as React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Ban, Copy, Download, ExternalLink, FileDown, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Card, CardContent } from '@strimz/ui'
import type { InvoiceStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { StatusPill } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { formatTokenAmount, relativeTime, tokenAmountToNumber } from '@/lib/format'
import { downloadInvoicePdf } from '@/lib/invoice-pdf'
import { useInvoice, useMerchantMe, useSendInvoice, useVoidInvoice } from '@/hooks/api'

const STATUS_TONE: Record<InvoiceStatus, 'positive' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  paid: 'positive',
  sent: 'info',
  draft: 'neutral',
  overdue: 'danger',
  void: 'neutral',
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: invoice, isPending, isError } = useInvoice(id)
  const { data: merchant } = useMerchantMe()
  const sendMutation = useSendInvoice()
  const voidMutation = useVoidInvoice()
  const [downloading, setDownloading] = React.useState(false)

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[#02C76A]" />
      </div>
    )
  }
  if (isError || !invoice) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/invoices">
            <ArrowLeft className="mr-1.5 size-4" /> Back to invoices
          </Link>
        </Button>
        <Card>
          <CardContent className="p-6 text-sm text-rose-600">Invoice not found.</CardContent>
        </Card>
      </div>
    )
  }

  const canSend = invoice.status === 'draft' || invoice.status === 'sent'
  const canVoid = invoice.status !== 'paid' && invoice.status !== 'void'

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadInvoicePdf(invoice, merchant ?? null)
    } catch (err) {
      toast.error(`Could not render PDF: ${(err as Error).message}`)
    } finally {
      setDownloading(false)
    }
  }

  const copyLink = async () => {
    if (!invoice.sessionId) return
    const url = `${window.location.origin}/pay/${invoice.sessionId}`
    await navigator.clipboard.writeText(url)
    toast.success('Payment link copied')
  }

  const subtotalNum = tokenAmountToNumber(invoice.subtotal)

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href="/app/invoices">
            <ArrowLeft className="mr-1.5 size-4" /> Back to invoices
          </Link>
        </Button>
        <PageHeader
          title={`Invoice ${invoice.number}`}
          description={invoice.customerName ?? 'No customer name'}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
                {downloading ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <FileDown className="mr-1.5 size-4" />
                )}
                Download PDF
              </Button>
              {canSend ? (
                <Button
                  size="sm"
                  onClick={() => sendMutation.mutate(invoice.id)}
                  disabled={sendMutation.isPending}
                >
                  <Send className="mr-1.5 size-4" />
                  {invoice.status === 'draft' ? 'Send' : 'Resend'}
                </Button>
              ) : null}
              {canVoid ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-rose-600 hover:text-rose-600"
                  onClick={() => voidMutation.mutate(invoice.id)}
                  disabled={voidMutation.isPending}
                >
                  <Ban className="mr-1.5 size-4" />
                  Void
                </Button>
              ) : null}
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wider">From</div>
                  <div className="mt-1 text-sm font-semibold">
                    {merchant?.businessName || 'Merchant'}
                  </div>
                  {merchant?.email && (
                    <div className="text-muted-foreground text-xs">{merchant.email}</div>
                  )}
                  {merchant?.websiteUrl && (
                    <div className="text-muted-foreground text-xs">{merchant.websiteUrl}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-xs uppercase tracking-wider">
                    Billed to
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {invoice.customerName ?? 'Customer'}
                  </div>
                  {invoice.customerEmail && (
                    <div className="text-muted-foreground text-xs">{invoice.customerEmail}</div>
                  )}
                </div>
              </div>

              <div className="border-border/60 grid grid-cols-3 gap-4 border-t pt-4">
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wider">
                    Issued
                  </div>
                  <div className="mt-1 text-sm">
                    {new Date(invoice.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wider">Due</div>
                  <div className="mt-1 text-sm">
                    {new Date(invoice.dueAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                    <span className="text-muted-foreground ml-1 text-xs">
                      ({relativeTime(invoice.dueAt)})
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wider">
                    Status
                  </div>
                  <div className="mt-1">
                    <StatusPill tone={STATUS_TONE[invoice.status]}>{invoice.status}</StatusPill>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-sora text-sm font-semibold">Line items</h3>
              <div className="border-border/60 mt-3 grid grid-cols-[minmax(0,3fr)_60px_120px_120px] gap-2 border-b pb-2 text-[10px] uppercase tracking-wider text-[#8B8896]">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit</span>
                <span className="text-right">Amount</span>
              </div>
              <div className="divide-border/60 divide-y">
                {invoice.lineItems.map((li, idx) => {
                  const unit = tokenAmountToNumber(li.unitAmount)
                  const amount = unit * li.quantity
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-[minmax(0,3fr)_60px_120px_120px] gap-2 py-3 text-sm"
                    >
                      <span>{li.description}</span>
                      <span className="text-right">{li.quantity}</span>
                      <span className="text-right font-mono">
                        {unit.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                        {invoice.currency}
                      </span>
                      <span className="text-right font-mono">
                        {amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                        {invoice.currency}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="border-border/60 mt-4 flex flex-col items-end gap-1 border-t pt-4 text-sm">
                <div className="flex w-64 items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">
                    {subtotalNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                    {invoice.currency}
                  </span>
                </div>
                <div className="border-border/60 mt-1 flex w-64 items-center justify-between border-t pt-2 text-base font-semibold">
                  <span>Total due</span>
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <TokenLogo symbol={invoice.currency} size={14} />
                    {formatTokenAmount(invoice.total, invoice.currency)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {invoice.note ? (
            <Card>
              <CardContent className="space-y-2 p-6">
                <h3 className="font-sora text-sm font-semibold">Note</h3>
                <p className="text-muted-foreground whitespace-pre-wrap text-sm">{invoice.note}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-sora text-sm font-semibold">Payment link</h3>
                <Badge variant="outline" className="text-[10px]">
                  hosted checkout
                </Badge>
              </div>
              {invoice.sessionId ? (
                <>
                  <div className="border-border/60 bg-muted/30 break-all rounded-md border p-3 font-mono text-[11px]">
                    /pay/{invoice.sessionId}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={copyLink}>
                      <Copy className="mr-1.5 size-3.5" />
                      Copy link
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/pay/${invoice.sessionId}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Send this link to your customer, or click Send above to email it directly.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">
                  No payment session linked yet. This should have been created automatically. Try
                  refreshing or re-issuing.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-6">
              <h3 className="font-sora text-sm font-semibold">Timeline</h3>
              <TimelineItem
                label="Created"
                value={new Date(invoice.createdAt).toLocaleString()}
                done
              />
              <TimelineItem
                label="Sent"
                value={invoice.sentAt ? new Date(invoice.sentAt).toLocaleString() : 'Not sent yet'}
                done={!!invoice.sentAt}
              />
              <TimelineItem
                label="Paid"
                value={
                  invoice.paidAt ? new Date(invoice.paidAt).toLocaleString() : 'Awaiting payment'
                }
                done={!!invoice.paidAt}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Download className="mr-1.5 size-4" />
                )}
                Download PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function TimelineItem({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div
        className={[
          'mt-1.5 size-1.5 rounded-full',
          done ? 'bg-[#02C76A]' : 'bg-muted-foreground/40',
        ].join(' ')}
      />
      <div className="flex-1 text-sm">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div>{value}</div>
      </div>
    </div>
  )
}
