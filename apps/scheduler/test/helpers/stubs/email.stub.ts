export interface RecordedEmail {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export class StubEmailService {
  public readonly sent: RecordedEmail[] = []

  async send(opts: RecordedEmail): Promise<{ id: string | null; queued: boolean }> {
    this.sent.push(opts)
    return { id: `mock_${this.sent.length}`, queued: true }
  }

  reset() {
    this.sent.length = 0
  }
}
