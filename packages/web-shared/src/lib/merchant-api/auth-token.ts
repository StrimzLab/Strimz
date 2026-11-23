'use client'

import { getAccessToken } from '@privy-io/react-auth'

/**
 * A `() => Promise<string | null>` that the merchant API client calls
 * before every request to attach the Privy bearer token.
 *
 * Why a function and not a stored string:
 *   - Privy refreshes the access token in the background. Caching the
 *     token at module load (or in a React state) would silently use a
 *     stale value past expiry, and the API would 401 in a delayed,
 *     hard-to-trace way.
 *   - The Privy SDK already memoises the in-flight token internally,
 *     so calling `getAccessToken()` per-request is cheap.
 *   - Keeping this as a function pointer lets tests pass a stub token
 *     provider without monkey-patching the module.
 */
export type AccessTokenProvider = () => Promise<string | null>

// Null when nobody is signed in. Only works from the same Privy copy as the mounted
// PrivyProvider; apps that can, pass usePrivy().getAccessToken instead.
export const defaultAccessTokenProvider: AccessTokenProvider = () => getAccessToken()
