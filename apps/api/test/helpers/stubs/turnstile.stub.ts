/**
 * Turnstile stub. The string `"good-token"` always passes; anything else
 * fails. Tests that don't care can stick to `"good-token"`.
 */
export class StubTurnstileService {
  async verify(token: string | null | undefined, _ip?: string): Promise<boolean> {
    return token === 'good-token'
  }
}
