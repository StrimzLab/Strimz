'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button, Card, CardContent } from '@strimz/ui'

import { PageHeader } from '@strimz/web-shared/components/dashboard/page-header'
import { useNotificationBroadcast } from '@/hooks/api/use-notifications'
import { relativeTime } from '@strimz/web-shared/lib/format'
import { NotFoundError } from '@strimz/web-shared/lib/merchant-api/errors'

export default function BroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: broadcast, isPending, isError, error, refetch } = useNotificationBroadcast(id)

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-brand-text size-6 animate-spin" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-6 text-sm">
            {error instanceof NotFoundError ? (
              <span className="text-muted-foreground">This message isn&apos;t available.</span>
            ) : (
              <>
                <span className="text-danger">Couldn&apos;t load this message.</span>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Try again
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        title={broadcast.title}
        description={`From the Strimz team, ${relativeTime(broadcast.createdAt)}.`}
      />
      <Card>
        <CardContent className="p-6">
          <div
            className="prose prose-sm prose-strimz text-foreground max-w-none"
            dangerouslySetInnerHTML={{ __html: broadcast.html }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild className="-ml-3">
      <Link href="/app">
        <ArrowLeft className="mr-1.5 size-4" />
        Back to dashboard
      </Link>
    </Button>
  )
}
