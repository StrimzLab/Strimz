'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, KeyRound, LogOut, Menu, User, X } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@strimz/ui'
import { cn } from '@strimz/ui'

interface Props {
  title?: string
  onMenuClick: () => void
  menuOpen: boolean
}

export function DashboardTopbar({ title, onMenuClick, menuOpen }: Props) {
  const router = useRouter()
  const privy = usePrivyOrNull()
  const [copied, setCopied] = useState(false)

  async function handleLogout() {
    await privy?.logout?.()
    router.push('/')
  }

  const email =
    (privy?.user as { email?: { address?: string } } | undefined)?.email?.address ?? null
  const wallet =
    (privy?.user as { wallet?: { address?: string } } | undefined)?.wallet?.address ?? null
  const initials = (email ?? 'A').slice(0, 1).toUpperCase()

  async function copyAddress() {
    if (!wallet) return
    await navigator.clipboard.writeText(wallet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <button
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={onMenuClick}
          className="shadow-sub-card flex size-9 items-center justify-center rounded-md border border-border/60 lg:hidden"
        >
          <span className="relative block size-5">
            <Menu
              className={cn('absolute inset-0 size-5 transition-all', menuOpen ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100')}
            />
            <X
              className={cn('absolute inset-0 size-5 transition-all', menuOpen ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0')}
            />
          </span>
        </button>

        <div className="hidden flex-col sm:flex">
          <h1 className="font-poppins text-base font-medium">{title ?? 'Dashboard'}</h1>
          {wallet && (
            <button
              type="button"
              onClick={copyAddress}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="size-1.5 rounded-full bg-[#02C76A]" />
              {wallet.slice(0, 8)}…{wallet.slice(-6)}
              <span className="opacity-60">{copied ? '· copied!' : '· copy'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="shadow-sub-icon gap-2 rounded-md border border-border/60 px-2">
              <Avatar className="size-7">
                <AvatarFallback className="bg-[#02C76A]/15 text-xs font-medium text-[#02C76A]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm sm:inline">{email ?? 'Account'}</span>
              <ChevronDown className="size-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/settings">
                <User className="mr-2 size-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/api-keys">
                <KeyRound className="mr-2 size-4" />
                API keys
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-rose-600">
              <LogOut className="mr-2 size-4" />
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
