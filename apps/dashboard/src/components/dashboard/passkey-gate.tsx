'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { KeyRound } from 'lucide-react'
import { Button } from '@strimz/ui'

import { usePasskeyMfa } from '@/hooks/use-passkey-mfa'
import { SECURITY_TAB } from '@/lib/settings-tabs'

/** Shows `children` only once the merchant's passkey can confirm sensitive actions. */
export function PasskeyGate({ action, children }: { action: string; children: ReactNode }) {
  const { user, enrolled } = usePasskeyMfa()
  if (!user || enrolled) return <>{children}</>
  return (
    <div className="border-border/60 bg-card space-y-3 rounded-xl border p-5">
      <div className="flex items-start gap-3">
        <KeyRound className="text-brand-text mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Add a passkey to {action}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Strimz asks for your passkey before money leaves your wallet or your payout wallet
            changes, so nobody else can do it with a stolen login.
          </p>
        </div>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href={`/app/settings?tab=${SECURITY_TAB}`}>Add a passkey in Settings</Link>
      </Button>
    </div>
  )
}
