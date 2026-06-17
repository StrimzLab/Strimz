'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, KeyRound, Sparkles } from 'lucide-react'
import { Card, CardContent, Input, Label } from '@strimz/ui'
import { MerchantPasskeyEnrol } from '@strimz/stellar-passkey/react'
import { PageHeader } from '@/components/dashboard/page-header'
import { SubmitButton } from '@/components/auth/submit-button'
import { useMerchantMe, useOnboardMerchant } from '@/hooks/api/use-merchant'
import { env } from '@/lib/env'

const SECTORS = [
  'SaaS',
  'E-commerce',
  'Marketplace',
  'Media & content',
  'Financial services',
  'Other',
] as const

/**
 * Which chain ids the form currently knows about. EVM is mandatory
 * (Strimz needs at least one settlement target); Stellar is opt-in via
 * the passkey-enrolment flow. The chain id strings match the
 * `SupportedChain.id` rows seeded in migration 20260616153212.
 */
const EVM_CHAIN_ID = 'evm:base'
const STELLAR_CHAIN_ID = (
  env.stellarNetwork === 'pubnet' ? 'stellar:pubnet' : 'stellar:testnet'
) as 'stellar:pubnet' | 'stellar:testnet'

export default function OnboardingPage() {
  const router = useRouter()
  const onboard = useOnboardMerchant()
  const { data: merchant } = useMerchantMe()

  const [form, setForm] = useState({
    businessName: '',
    businessSector: SECTORS[0] as (typeof SECTORS)[number],
    countryCode: '',
    websiteUrl: '',
    phone: '',
    evmPayout: '',
    stellarPayout: '',
    stellarEnrolled: false,
  })

  // Seed the EVM payout from the Privy embedded wallet the moment the
  // merchant row resolves — the merchant can still override before
  // submitting. Keeps the common path "click submit" fast.
  useEffect(() => {
    if (merchant?.walletAddress && !form.evmPayout) {
      setForm((f) => ({ ...f, evmPayout: merchant.walletAddress as string }))
    }
  }, [merchant?.walletAddress, form.evmPayout])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const payoutAddresses: Record<string, string> = {}
    if (form.evmPayout) payoutAddresses[EVM_CHAIN_ID] = form.evmPayout
    if (form.stellarPayout) payoutAddresses[STELLAR_CHAIN_ID] = form.stellarPayout

    try {
      await onboard.mutateAsync({
        businessName: form.businessName,
        businessSector: form.businessSector,
        countryCode: form.countryCode,
        payoutAddresses,
        websiteUrl: form.websiteUrl || undefined,
        phone: form.phone || undefined,
      })
      router.push('/app')
    } catch {
      // useMutationWithToast surfaces the error; form stays so the
      // merchant can correct + retry.
    }
  }

  return (
    <>
      <PageHeader
        title="Tell us about your business"
        description="Powers your dashboard, your storefront, and your live-mode eligibility."
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-[#02C76A]/10 px-2 py-0.5 text-xs font-medium text-[#02C76A]">
            <Sparkles className="size-3" />
            Self-attested
          </span>
        }
      />

      <Card className="shadow-sub-card border-border/60 max-w-2xl">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ---------- Business profile ---------- */}

            <Field label="Business name" required>
              <Input
                value={form.businessName}
                onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                placeholder="Acme Inc."
                required
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Business sector" required>
                <select
                  value={form.businessSector}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      businessSector: e.target.value as (typeof SECTORS)[number],
                    }))
                  }
                  className="border-border bg-background h-10 w-full rounded-md border px-3 text-sm"
                  required
                >
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Country" required>
                <Input
                  value={form.countryCode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      countryCode: e.target.value.toUpperCase().slice(0, 2),
                    }))
                  }
                  maxLength={2}
                  placeholder="US"
                  required
                />
              </Field>
            </div>

            <Field label="Website (optional)">
              <Input
                value={form.websiteUrl}
                onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                placeholder="https://acme.com"
                type="url"
              />
            </Field>

            <Field label="Phone (optional)">
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 0100"
              />
            </Field>

            {/* ---------- Payouts: per-chain section ---------- */}

            <div className="border-border/60 rounded-lg border p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Payout setup</h3>
                <p className="text-muted-foreground text-xs">
                  USDC settlements arrive at these addresses, one per chain you accept. Pick at
                  least one.
                </p>
              </div>

              {/* EVM (Base) — always shown, default-on. */}
              <Field
                label="Base (EVM)"
                required
                help="Auto-filled from your Privy embedded wallet."
              >
                <Input
                  value={form.evmPayout}
                  onChange={(e) => setForm((f) => ({ ...f, evmPayout: e.target.value }))}
                  placeholder="0x…"
                  pattern="^0x[a-fA-F0-9]{40}$"
                  required
                />
              </Field>

              {/* Stellar — optional. */}
              <div className="border-border/60 mt-4 rounded-md border-t pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Stellar (optional)</p>
                    <p className="text-muted-foreground text-xs">
                      Create a passkey-secured smart wallet, or paste a Stellar address you already
                      control.
                    </p>
                  </div>
                </div>

                {!form.stellarEnrolled && !form.stellarPayout && (
                  <MerchantPasskeyEnrol
                    merchantEmail={merchant?.email ?? 'merchant@strimz.finance'}
                    deployer={env.stellarDeployerAddress}
                    network={env.stellarNetwork}
                    onEnrolled={(result) => {
                      setForm((f) => ({
                        ...f,
                        stellarPayout: result.walletAddress,
                        stellarEnrolled: true,
                      }))
                    }}
                  />
                )}

                {form.stellarPayout && (
                  <Field label="Stellar wallet address">
                    <Input
                      value={form.stellarPayout}
                      onChange={(e) => setForm((f) => ({ ...f, stellarPayout: e.target.value }))}
                      placeholder="C… (smart wallet) or G… (classic account)"
                      pattern="^[GC][A-Z2-7]{55}$"
                    />
                  </Field>
                )}

                {!form.stellarPayout && (
                  <details className="text-muted-foreground mt-3 text-xs">
                    <summary className="cursor-pointer">
                      <KeyRound className="mr-1 inline size-3" />I already have a Stellar wallet
                    </summary>
                    <div className="mt-2">
                      <Input
                        value={form.stellarPayout}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            stellarPayout: e.target.value,
                            stellarEnrolled: false,
                          }))
                        }
                        placeholder="C… or G…"
                        pattern="^[GC][A-Z2-7]{55}$"
                      />
                    </div>
                  </details>
                )}
              </div>
            </div>

            <SubmitButton type="submit" isLoading={onboard.isPending} loadingText="Saving…">
              Complete onboarding
              <ArrowRight className="size-4" />
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

function Field({
  label,
  children,
  required,
  help,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
  help?: string
}) {
  return (
    <div>
      <Label className="mb-1.5 inline-flex items-center gap-1">
        {label}
        {required && <span className="text-[#02C76A]">*</span>}
      </Label>
      {children}
      {help && <p className="text-muted-foreground mt-1 text-xs">{help}</p>}
    </div>
  )
}
