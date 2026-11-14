'use client'

import { Card, CardContent } from '@strimz/ui'

import { PageHeader } from '@/components/dashboard/page-header'
import { relativeTime } from '@/lib/format'
import { useAdminHealth } from '@/hooks/admin'

export default function AdminHealthPage() {
  const { data, isLoading, isError, error } = useAdminHealth()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Health"
        description="Operational status. Indexer cursors, recent webhook delivery, subscription risk. Refreshes every 30 seconds."
      />

      {isError ? (
        <Card className="border-border/60">
          <CardContent className="p-4 text-xs">
            Couldn’t load health: {error?.message ?? 'unknown error'}
          </CardContent>
        </Card>
      ) : isLoading || !data ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-border/60 bg-muted/30 h-24 animate-pulse rounded-xl border"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Indexer cursors */}
          <Card className="border-border/60">
            <CardContent className="p-6">
              <h3 className="font-sora text-base font-semibold">Indexer cursors</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Last block processed per watched contract.
              </p>
              <div className="mt-4 space-y-2">
                {data.indexerCursors.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No cursors yet.</p>
                ) : (
                  data.indexerCursors.map((c) => (
                    <div
                      key={`${c.environment}-${c.contractAddress}`}
                      className="border-border/60 flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <code className="text-xs">{c.contractAddress.slice(0, 10)}…</code>
                        <span className="text-muted-foreground ml-2 text-[10px] capitalize">
                          {c.environment}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xs">block {c.lastProcessedBlock}</div>
                        <div className="text-muted-foreground text-[11px]">
                          updated {relativeTime(c.updatedAt)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Webhook delivery */}
          <Card className="border-border/60">
            <CardContent className="p-6">
              <h3 className="font-sora text-base font-semibold">Webhook delivery (last hour)</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Counts of delivery rows created in the last hour, by status.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {Object.entries(data.webhookDelivery1h).length === 0 ? (
                  <p className="text-muted-foreground col-span-2 py-4 text-center text-xs">
                    No deliveries in the last hour.
                  </p>
                ) : (
                  Object.entries(data.webhookDelivery1h).map(([status, count]) => (
                    <div key={status} className="border-border/60 rounded-md border p-3">
                      <div className="text-muted-foreground text-[11px] capitalize">
                        {status.replace(/_/g, ' ')}
                      </div>
                      <div className="font-sora mt-1 text-xl font-semibold">{count}</div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Subscription risk */}
          <Card className="border-border/60 lg:col-span-2">
            <CardContent className="p-6">
              <h3 className="font-sora text-base font-semibold">Subscription risk</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Subs that need attention or have already churned in the last week.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Stat
                  label="At risk"
                  value={data.subscriptions.atRisk.toLocaleString()}
                  tone={data.subscriptions.atRisk > 0 ? 'warning' : undefined}
                />
                <Stat
                  label="Lapsed (last 7d)"
                  value={data.subscriptions.lapsedLast7d.toLocaleString()}
                  tone={data.subscriptions.lapsedLast7d > 0 ? 'danger' : undefined}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'warning' | 'danger'
}) {
  return (
    <div className="border-border/60 rounded-md border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={[
          'font-sora mt-1 text-2xl font-semibold',
          tone === 'danger' ? 'text-rose-600' : tone === 'warning' ? 'text-amber-600' : '',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}
