import { getAccessToken } from '@privy-io/react-auth'
import { primaryNetwork } from '@strimz/web-shared/lib/networks'

/** Creates or refreshes the merchant from the Privy session, on the live account unless told otherwise. */
export async function syncSession(
  turnstileToken?: string | null,
  apiUrl: string = primaryNetwork.apiUrl,
): Promise<Response> {
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('No access token from Privy')
  return fetch(`${apiUrl}/v1/auth/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accessToken, ...(turnstileToken ? { turnstileToken } : {}) }),
  })
}
