'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { KeyRound, LogOut, Menu, Sparkles, User, X } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@strimz/ui'
import { cn } from '@strimz/ui'
import { runDashboardTour } from '@/hooks/use-dashboard-tour'
import { BlockieAvatar } from './blockie-avatar'
import { ModeToggle } from './mode-toggle'
import { NotificationsPopover } from './notifications-popover'

interface Props {
  title?: string
  onMenuClick: () => void
  menuOpen: boolean
}

/**
 * Dashboard topbar. Two identity-related upgrades vs the previous
 * layout:
 *
 *   1. **Blockies avatar** replaces the "first letter of email" fallback.
 *      Seeded from the merchant's Privy embedded-wallet address (falls
 *      back to the login email so a merchant with no wallet yet still
 *      renders a stable avatar). Clicking it opens the profile
 *      dropdown, same as before. Email is no longer rendered next
 *      to it, per feedback that it clutters the header.
 *   2. **Notifications bell**. Sits left of the avatar, shows an
 *      unread count based on activity since the last time the tray
 *      was opened. Feed pulls from `usePaymentSessions` +
 *      `useSubscriptions` + `useRefunds`.
 */
export function DashboardTopbar({ title, onMenuClick, menuOpen }: Props) {
  const router = useRouter()
  const privy = usePrivyOrNull()
  const [copied, setCopied] = useState(false)

  async function handleLogout() {
    try {
      await privy?.logout?.()
    } finally {
      router.replace('/login')
    }
  }

  const email =
    (privy?.user as { email?: { address?: string } } | undefined)?.email?.address ?? null
  const wallet =
    (privy?.user as { wallet?: { address?: string } } | undefined)?.wallet?.address ?? null

  // Deterministic seed for the blockies avatar: wallet address if we
  // have it (cheap uniqueness + spans a wide colour range), else the
  // login email so the render stays stable across page loads.
  const avatarSeed = wallet ?? email

  async function copyAddress() {
    if (!wallet) return
    await navigator.clipboard.writeText(wallet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <header className="border-border/40 bg-background/80 sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <button
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={onMenuClick}
          className="shadow-sub-card border-border/60 flex size-9 items-center justify-center rounded-md border lg:hidden"
        >
          <span className="relative block size-5">
            <Menu
              className={cn(
                'absolute inset-0 size-5 transition-all',
                menuOpen ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100',
              )}
            />
            <X
              className={cn(
                'absolute inset-0 size-5 transition-all',
                menuOpen ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0',
              )}
            />
          </span>
        </button>

        <div className="hidden flex-col sm:flex">
          <h1 className="font-poppins text-base font-medium">{title ?? 'Dashboard'}</h1>
          {wallet && (
            <button
              type="button"
              onClick={copyAddress}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
            >
              <span className="size-1.5 rounded-full bg-[#02C76A]" />
              {wallet.slice(0, 8)}…{wallet.slice(-6)}
              <span className="opacity-60">{copied ? '· copied!' : '· copy'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <ModeToggle />
        <button
          type="button"
          onClick={() => runDashboardTour()}
          className="hover:shadow-sub-icon border-border/60 inline-flex h-9 items-center gap-1.5 rounded-md border bg-white px-2 text-xs font-medium text-[#050020] transition-colors hover:bg-[#F9FAFB] sm:px-3"
          aria-label="Take the dashboard tour"
        >
          <Sparkles className="size-3.5 text-[#02C76A]" />
          <span className="hidden sm:inline">Take a tour</span>
        </button>
        <NotificationsPopover />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open account menu"
              className="hover:shadow-sub-icon border-border/60 focus-visible:outline-brand flex size-9 items-center justify-center overflow-hidden rounded-full border transition-transform hover:scale-105 focus:outline-none"
            >
              <BlockieAvatar seed={avatarSeed} size={32} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="mt-1.5 w-56">
            <DropdownMenuLabel className="flex items-center gap-2">
              <BlockieAvatar seed={avatarSeed} size={28} />
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="font-poppins truncate text-xs font-medium text-[#050020]">
                  {email ?? 'Account'}
                </span>
                {wallet && (
                  <span className="font-mono text-[10px] text-[#58556A]">
                    {wallet.slice(0, 6)}…{wallet.slice(-4)}
                  </span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/settings">
                <User className="size-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/api-keys">
                <KeyRound className="size-4" />
                API keys
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-rose-600">
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function usePrivyOrNull() {
  try {
    return usePrivy()
  } catch {
    return null
  }
}
