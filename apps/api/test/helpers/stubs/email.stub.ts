export interface RecordedEmail {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

/** Replaces Resend-backed `EmailService`; records every send. */
export class StubEmailService {
  public readonly sent: RecordedEmail[] = []

  send(options: RecordedEmail): Promise<{ id: string | null; queued: boolean }> {
    this.sent.push(options)
    return Promise.resolve({ id: `mock_${this.sent.length}`, queued: true })
  }

  reset() {
    this.sent.length = 0
  }
}
