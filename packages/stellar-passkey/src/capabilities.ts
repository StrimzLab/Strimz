/**
 * Browser-side capability detection. WebAuthn flows fail in three
 * common shapes that warrant distinct UX:
 *
 *   - the API is not present (very old browser, embedded webview)
 *   - the page isn't a secure context (`http://` outside localhost)
 *   - no platform authenticator (no Touch ID / Face ID / Windows Hello)
 *
 * The third one is detected via `isUserVerifyingPlatformAuthenticatorAvailable`,
 * which is itself async and not always implemented — treat absence as
 * "unknown" rather than "blocked."
 */

export interface BrowserCapabilities {
  /** `navigator.credentials.create` exists. */
  webauthnAvailable: boolean
  /** Top-level secure context (HTTPS or localhost). */
  secureContext: boolean
  /** A roaming or platform authenticator was detected, when known. */
  platformAuthenticator: boolean | null
}

/**
 * Snapshot of what the current browser can do with passkeys. Cheap
 * (no I/O beyond the optional platform-authenticator probe).
 */
export async function detectCapabilities(): Promise<BrowserCapabilities> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { webauthnAvailable: false, secureContext: false, platformAuthenticator: null }
  }

  const webauthnAvailable =
    typeof navigator.credentials !== 'undefined' &&
    typeof navigator.credentials.create === 'function' &&
    typeof PublicKeyCredential !== 'undefined'

  const secureContext = typeof window.isSecureContext === 'boolean' ? window.isSecureContext : false

  let platformAuthenticator: boolean | null = null
  if (
    webauthnAvailable &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  ) {
    try {
      platformAuthenticator =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    } catch {
      platformAuthenticator = null
    }
  }

  return { webauthnAvailable, secureContext, platformAuthenticator }
}

/**
 * True when the browser can definitely complete a passkey ceremony.
 * The platform-authenticator probe is intentionally permissive — it
 * may be null on browsers that don't expose the probe, and we'd
 * rather attempt the ceremony than block.
 */
export function isPasskeySupported(c: BrowserCapabilities): boolean {
  return c.webauthnAvailable && c.secureContext && c.platformAuthenticator !== false
}
