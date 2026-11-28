import { TERMS_VERSION } from '@strimz/shared-config'
import type { Merchant, OnboardMerchantInput } from '@strimz/shared-types'
import { MerchantNotSyncedError } from '@strimz/web-shared/lib/merchant-api/errors'

export interface TestAccountDeps {
  /** The live account, already onboarded. */
  primary: Merchant
  /** A Turnstile token from the check on this screen, if the test API asked for one. */
  token: string | null
  retrieve: () => Promise<Merchant>
  sync: (token: string | null) => Promise<Response>
  onboard: (input: OnboardMerchantInput) => Promise<Merchant>
  acceptTerms: (version: string) => Promise<Merchant>
}

export type TestAccountResult = { kind: 'ready' } | { kind: 'needs-check' }

/** The live onboarding details, as the test backend's onboarding form expects them. */
export function onboardInputFrom(m: Merchant): OnboardMerchantInput {
  if (!m.businessSector || !m.countryCode || !m.payoutAddress) {
    throw new Error('Finish onboarding your live account before using test mode.')
  }
  return {
    businessName: m.businessName,
    businessSector: m.businessSector,
    countryCode: m.countryCode,
    payoutAddress: m.payoutAddress,
    defaultCurrency: m.defaultCurrency,
    ...(m.websiteUrl ? { websiteUrl: m.websiteUrl } : {}),
    ...(m.logoUrl ? { logoUrl: m.logoUrl } : {}),
    ...(m.phone ? { phone: m.phone } : {}),
    ...(m.termsVersion === TERMS_VERSION ? { acceptedTerms: TERMS_VERSION } : {}),
  }
}

/**
 * Makes sure the merchant has a test account like their live one: created, onboarded with the
 * same details and on the current terms (ADR-2026-11-26-test-mode). Safe to run on every visit.
 */
export async function ensureTestAccount(d: TestAccountDeps): Promise<TestAccountResult> {
  let me: Merchant
  try {
    me = await d.retrieve()
  } catch (err) {
    if (!(err instanceof MerchantNotSyncedError)) throw err
    const res = await d.sync(d.token)
    if (res.status === 428) return { kind: 'needs-check' }
    if (!res.ok) throw new Error(`Strimz couldn't create your test account (${res.status}).`)
    me = await d.retrieve()
  }
  if (!me.onboardingCompleted) me = await d.onboard(onboardInputFrom(d.primary))
  if (me.termsVersion !== TERMS_VERSION) await d.acceptTerms(TERMS_VERSION)
  return { kind: 'ready' }
}
