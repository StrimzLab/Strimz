/**
 * Turnstile stub. `"good-token"` passes for any action; `"good-token:<action>"`
 * passes only for that action. Anything else fails.
 */
export class StubTurnstileService {
  verify(
    token: string | null | undefined,
    _ip?: string,
    expectedAction?: string,
    _expectedHostname?: string,
  ): Promise<boolean> {
    if (token === 'good-token') return Promise.resolve(true)
    return Promise.resolve(expectedAction !== undefined && token === `good-token:${expectedAction}`)
  }
}
