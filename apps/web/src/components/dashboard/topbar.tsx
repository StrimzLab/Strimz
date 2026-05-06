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

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="shadow-sub-icon focus-within:none focus:none focus-visible:none border-border/60 gap-2 rounded-md border px-2"
            >
              <Avatar className="size-7">
                <AvatarFallback className="bg-[#02C76A]/15 text-xs font-medium text-[#02C76A]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm sm:inline">{email ?? 'Account'}</span>
              <ChevronDown className="size-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="mt-1.5 w-40">
            <DropdownMenuLabel>My account</DropdownMenuLabel>
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
