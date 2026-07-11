'use client'

import { useMemo, useState } from 'react'
import { Megaphone, Search, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
} from '@strimz/ui'
import type { AdminMerchantListItem, Broadcast, BroadcastAudience } from '@/lib/admin-api'

import { PageHeader } from '@/components/dashboard/page-header'
import { RichTextEditor } from '@/components/admin/rich-text-editor'
import { useAdminBroadcasts, useAdminMerchants, useCreateBroadcast } from '@/hooks/admin'

const AUDIENCE_LABEL: Record<BroadcastAudience, string> = {
  all: 'All merchants',
  merchant: 'One merchant',
}

/**
 * Admin broadcasts page. Two-column layout:
 *
 *   left. The composer: audience picker, title, TipTap-backed rich
 *     text editor. Enforces the same rules the API DTO enforces so
 *     invalid submissions never leave the page.
 *   right. The log of what's been sent, most recent first, with
 *     audience + delivery status. Refetches after the compose form
 *     succeeds so operators see their own send land immediately.
 */
export default function AdminBroadcastsPage() {
  const [audience, setAudience] = useState<BroadcastAudience>('all')
  const [merchantQuery, setMerchantQuery] = useState('')
  const [merchantId, setMerchantId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')

  const broadcastsQuery = useAdminBroadcasts({ limit: 50 })
  // Only fetch the merchant picker when the audience needs it. The
  // list query is cheap but no need to warm it up on the "all" tab.
  const merchantsQuery = useAdminMerchants(
    { query: merchantQuery || undefined, limit: 20 },
    { enabled: audience === 'merchant' },
  )
  const createMutation = useCreateBroadcast()

  const isBodyEmpty = useMemo(() => {
    // TipTap emits `<p></p>` for an empty document; treat that + any
    // pure-whitespace HTML as empty for validation.
    const plain = bodyHtml.replace(/<[^>]+>/g, '').trim()
    return plain.length === 0
  }, [bodyHtml])

  const canSubmit =
    title.trim().length >= 4 &&
    !isBodyEmpty &&
    (audience !== 'merchant' || !!merchantId) &&
    !createMutation.isPending

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return
    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        body: bodyHtml,
        audience,
        ...(audience === 'merchant' && merchantId ? { merchantId } : {}),
      })
      // Reset composer on success. Audience selection stays so an
      // operator sending multiple broadcasts to the same audience
      // doesn't have to reselect it.
      setTitle('')
      setBodyHtml('')
      if (audience === 'merchant') setMerchantId(null)
    } catch {
      // Toast handles UX; keep composer state so the operator can fix + retry.
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Broadcasts"
        description="Send an announcement to every merchant, or a private message to one."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="shadow-sub-card border-border/60">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="font-poppins mb-2 block text-sm">Audience</Label>
                <RadioGroup
                  value={audience}
                  onValueChange={(v) => setAudience(v as BroadcastAudience)}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {(['all', 'merchant'] as const).map((v) => (
                    <label
                      key={v}
                      htmlFor={`audience-${v}`}
                      className={`border-border/60 flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                        audience === v ? 'border-[#02C76A]/60 bg-[#02C76A]/5' : ''
                      }`}
                    >
                      <RadioGroupItem id={`audience-${v}`} value={v} className="mt-0.5" />
                      <div>
                        <div className="font-poppins text-sm font-medium">{AUDIENCE_LABEL[v]}</div>
                        <div className="font-poppins text-muted-foreground text-xs">
                          {v === 'all'
                            ? 'Every active merchant. Use for platform-wide announcements.'
                            : 'One merchant, by email. Use for ops follow-ups.'}
                        </div>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {audience === 'merchant' && (
                <div>
                  <Label className="font-poppins mb-2 block text-sm">Merchant</Label>
                  <div className="relative">
                    <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input
                      value={merchantQuery}
                      onChange={(e) => setMerchantQuery(e.target.value)}
                      placeholder="Search by email or business name…"
                      className="pl-9"
                    />
                  </div>
                  <div className="border-border/60 mt-2 max-h-40 overflow-y-auto rounded-md border">
                    {merchantsQuery.isPending ? (
                      <div className="font-poppins p-3 text-xs text-[#58556A]">Loading…</div>
                    ) : (merchantsQuery.data?.data ?? []).length === 0 ? (
                      <div className="font-poppins p-3 text-xs text-[#58556A]">
                        No merchants match &ldquo;{merchantQuery}&rdquo;.
                      </div>
                    ) : (
                      <ul className="divide-border/60 divide-y">
                        {(merchantsQuery.data?.data ?? []).map((m: AdminMerchantListItem) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => setMerchantId(m.id)}
                              className={`hover:bg-muted/40 flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${
                                merchantId === m.id ? 'bg-[#02C76A]/10' : ''
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-poppins truncate text-sm text-[#050020]">
                                  {m.businessName ?? m.email}
                                </div>
                                <div className="font-poppins truncate text-xs text-[#58556A]">
                                  {m.email}
                                </div>
                              </div>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {m.tier}
                              </Badge>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="title" className="font-poppins mb-2 block text-sm">
                  Subject
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What are you telling them?"
                  maxLength={160}
                  required
                />
                <p className="font-poppins text-muted-foreground mt-1 text-[10px]">
                  Used as the email subject and the tray title. 4–160 characters.
                </p>
              </div>

              <div>
                <Label className="font-poppins mb-2 block text-sm">Message</Label>
                <RichTextEditor
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  disabled={createMutation.isPending}
                  placeholder="Write to your merchants…"
                />
                <p className="font-poppins text-muted-foreground mt-1 text-[10px]">
                  Sent as HTML in the email and rendered as-is on the notifications page. Rich
                  formatting; keep it short.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button type="submit" disabled={!canSubmit} className="min-w-[140px]">
                  <Megaphone className="mr-1 size-4" />
                  {createMutation.isPending ? 'Sending…' : 'Send broadcast'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-[#58556A]" />
            <h3 className="font-poppins text-sm font-medium">Recent broadcasts</h3>
          </div>
          {broadcastsQuery.isPending ? (
            <Card className="border-border/60">
              <CardContent className="font-poppins p-4 text-xs text-[#58556A]">
                Loading…
              </CardContent>
            </Card>
          ) : (broadcastsQuery.data?.data ?? []).length === 0 ? (
            <Card className="border-border/60 border-dashed">
              <CardContent className="font-poppins p-4 text-xs text-[#58556A]">
                No broadcasts sent yet. Yours will show up here.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {(broadcastsQuery.data?.data ?? []).map((b: Broadcast) => (
                <li key={b.id}>
                  <Card className="border-border/60">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-poppins truncate text-sm font-medium text-[#050020]">
                            {b.title}
                          </div>
                          <div className="font-poppins mt-0.5 text-[10px] text-[#58556A]">
                            {formatDistanceToNow(new Date(b.createdAt), {
                              addSuffix: true,
                            })}{' '}
                            · {b.senderEmail}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                          {b.audience === 'all' ? 'All' : (b.merchantEmail ?? 'One')}
                        </Badge>
                      </div>
                      <div className="font-poppins text-muted-foreground mt-2 line-clamp-2 text-xs">
                        {b.body
                          .replace(/<[^>]*>/g, ' ')
                          .replace(/\s+/g, ' ')
                          .trim()}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
