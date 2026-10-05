'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Bell, CheckCircle2, CreditCard, Megaphone, RefreshCcw, Repeat } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@strimz/ui'
import type { NotificationKind } from '@strimz/shared-types'
import { useMarkNotificationsRead, useNotifications } from '@/hooks/api/use-notifications'

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  payment_received: CreditCard,
  subscription_started: Repeat,
  refund_processed: RefreshCcw,
  admin_broadcast: Megaphone,
}

/**
 * Header-bell notifications dropdown. Fully server-driven. The tray
 * list, unread count, and read timestamp all come from the API. When
 * the dropdown opens we fire mark-all-read so the badge clears
 * instantly; the mutation is optimistic, so there's no delay between
 * click and the pip disappearing.
 *
 * Not a Dialog / not a modal. DropdownMenu, per merchant feedback.
 * The interaction pattern matches the account dropdown right next to
 * it, keeping the header a single interaction surface.
 */
export function NotificationsPopover() {
  const query = useNotifications()
  const markRead = useMarkNotificationsRead()

  const items = query.data?.data ?? []
  const unread = query.data?.unreadCount ?? 0

  // Fire mark-read whenever the tray shows unread items and the user
  // is looking at it. `open` state lives inside DropdownMenu; we hook
  // into it via a controlled `onOpenChange` handler below so the mark-
  // read call fires exactly once per open.
  useEffect(() => {
    if (!query.data) return
    // A gentle refetch when the query first lands with unread items ,
    // useful in case the tray was opened before the initial fetch
    // finished. `onOpenChange` handles the interactive case.
  }, [query.data])

  function handleOpen(open: boolean) {
    if (open && unread > 0 && !markRead.isPending) {
      markRead.mutate()
    }
  }

  return (
    <DropdownMenu onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="hover:shadow-sub-icon border-border/60 relative size-9 rounded-md border p-0"
          aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="bg-accent absolute -right-1 -top-1 grid size-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-semibold text-white shadow">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-[380px] p-0">
        <DropdownMenuLabel className="border-border/60 flex items-center justify-between border-b p-4">
          <span className="font-poppins flex items-center gap-2 text-sm font-medium">
            <Bell className="text-accent size-4" />
            Notifications
          </span>
          <span className="font-poppins text-muted-foreground text-[10px] font-normal">
            Refreshes every 30s
          </span>
        </DropdownMenuLabel>

        <div className="max-h-[60vh] overflow-y-auto">
          {query.isPending ? (
            <div className="font-poppins text-muted-foreground p-8 text-center text-sm">
              Loading…
            </div>
          ) : query.isError ? (
            <div className="font-poppins p-8 text-center text-sm text-rose-600">
              Couldn&apos;t load notifications.
            </div>
          ) : items.length === 0 ? (
            <div className="font-poppins text-muted-foreground p-8 text-center text-sm">
              Nothing here yet. Notifications will appear as your customers start paying,
              subscribing, or refunding.
            </div>
          ) : (
            <ul className="divide-border/60 divide-y">
              {items.map((n) => {
                const Icon = KIND_ICON[n.kind] ?? Bell
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      className="hover:bg-muted/40 flex items-start gap-3 p-4 transition-colors"
                    >
                      <div
                        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${!n.read ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'}`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-poppins text-foreground text-sm font-medium">
                            {n.title}
                          </p>
                          {!n.read && <span className="bg-accent size-1.5 rounded-full" />}
                        </div>
                        <p className="font-poppins text-muted-foreground mt-0.5 truncate text-xs">
                          {n.detail}
                        </p>
                        <p className="font-poppins text-muted-foreground mt-1 text-[10px]">
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <div className="flex items-center justify-between p-3">
          <span className="font-poppins text-muted-foreground text-[10px]">
            {items.length} recent activity item{items.length === 1 ? '' : 's'}
          </span>
          <span className="text-accent flex items-center gap-1.5">
            <CheckCircle2 className="size-3" />
            <span className="font-poppins text-[10px] font-medium">
              {unread === 0 ? 'All caught up' : `${unread} unread`}
            </span>
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
