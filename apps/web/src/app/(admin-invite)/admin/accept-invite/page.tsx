'use client'

import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { Button } from '@strimz/ui'

import { useAcceptAdminInvite } from '@/hooks/admin'

export default function AcceptAdminInvitePage() {
  return (
    <Suspense fallback={<InviteCard title="Admin invite">Loading invite…</InviteCard>}>
      <AcceptAdminInvite />
    </Suspense>
  )
}

function AcceptAdminInvite() {
  const token = useSearchParams().get('token')
  const router = useRouter()
  const { ready, authenticated, login, logout, user } = usePrivy()
  const accept = useAcceptAdminInvite()

  if (!token) {
    return (
      <InviteCard title="Invite link incomplete">
        This link has no invite token. Open the link from your invite email again, or ask a super
        admin to re-send the invite.
      </InviteCard>
    )
  }

  if (!ready) {
    return <InviteCard title="Admin invite">Checking your session…</InviteCard>
  }

  if (!authenticated) {
    return (
      <InviteCard
        title="Accept your Strimz admin invite"
        actions={<Button onClick={() => login()}>Sign in to continue</Button>}
      >
        Sign in with the email address this invite was sent to. The invite only works for that
        address.
      </InviteCard>
    )
  }

  const signedInAs = user?.email?.address ?? user?.google?.email ?? null

  return (
    <InviteCard
      title="Accept your Strimz admin invite"
      actions={
        <>
          <Button variant="outline" onClick={() => logout()} disabled={accept.isPending}>
            Use a different account
          </Button>
          <Button
            disabled={accept.isPending}
            onClick={() =>
              accept.mutate(token, {
                onSuccess: () => router.replace('/admin'),
              })
            }
          >
            {accept.isPending ? 'Accepting…' : 'Accept invite'}
          </Button>
        </>
      }
    >
      <p>
        {signedInAs ? (
          <>
            You are signed in as <strong className="text-foreground">{signedInAs}</strong>.
          </>
        ) : (
          'You are signed in.'
        )}{' '}
        Accepting binds this account to the admin role you were invited to.
      </p>
      {accept.isError ? (
        <p role="alert" className="text-destructive mt-3">
          {accept.error.message}
        </p>
      ) : null}
    </InviteCard>
  )
}

function InviteCard({
  title,
  children,
  actions,
}: {
  title: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <div className="border-border/60 bg-card mx-auto w-full max-w-md space-y-4 rounded-xl border p-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#02C76A]" />
          <span className="font-display font-semibold">Strimz Admin</span>
        </Link>
        <h1 className="font-sora text-xl font-semibold">{title}</h1>
        <div className="text-muted-foreground text-sm">{children}</div>
        {actions ? <div className="flex justify-end gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
