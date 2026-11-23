import { getAccessToken } from '@privy-io/react-auth'
import { env } from '@strimz/web-shared/lib/env'

/** Creates or refreshes the merchant from the Privy session. */
export async function syncSession(turnstileToken?: string | null): Promise<Response> {
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('No access token from Privy')
  return fetch(`${env.apiUrl}/v1/auth/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accessToken, ...(turnstileToken ? { turnstileToken } : {}) }),
  })
}
