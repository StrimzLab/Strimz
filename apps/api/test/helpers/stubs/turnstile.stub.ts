/**
 * Turnstile stub. The string `"good-token"` always passes; anything else
 * fails. Tests that don't care can stick to `"good-token"`.
 */
export class StubTurnstileService {
  verify(token: string | null | undefined, _ip?: string): Promise<boolean> {
    return Promise.resolve(token === 'good-token')
  }
}
