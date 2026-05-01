'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { toast } from 'sonner'
import { ArrowRight } from 'lucide-react'
import { AuthCard } from '@/components/auth/auth-card'
import { SubmitButton } from '@/components/auth/submit-button'

export default function LoginPage() {
  const router = useRouter()
  const privy = usePrivyOrNull()

  async function handleLogin() {
    if (!privy) {
      toast.error('Authentication not configured. Set NEXT_PUBLIC_PRIVY_APP_ID.')
      return
    }
    await privy.login()
    router.push('/auth/callback')
  }

  return (
    <AuthCard
      title="Log in to Strimz"
      description="Use the same email, wallet, or social account you signed up with."
    >
      <SubmitButton type="button" onClick={handleLogin}>
        Continue
        <ArrowRight className="size-4" />
      </SubmitButton>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Strimz?{' '}
        <Link href="/signup" className="font-medium text-foreground hover:underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  )
}

function usePrivyOrNull() {
  try {
    return usePrivy()
  } catch {
    return null
  }
}
