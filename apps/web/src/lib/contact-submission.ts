import type { ContactRequestInput } from '@strimz/shared-types'
import { env } from './env'

const CONTACT_REFUSALS: Record<string, string> = {
  bot_check_failed: 'We could not confirm you are a person. Complete the check again, then send.',
  email_unavailable: 'Your message was not sent. Try again in a few minutes.',
  rate_limited: 'Too many messages from your network. Try again in an hour.',
}

export async function submitContact(input: ContactRequestInput): Promise<void> {
  const res = await fetch(`${env.apiUrl.replace(/\/$/u, '')}/v1/contact`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (res.ok) return

  const detail = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string }
  }
  const code = detail.error?.code
  throw new Error(
    (code ? CONTACT_REFUSALS[code] : undefined) ??
      detail.error?.message ??
      `Something went wrong (${res.status})`,
  )
}
