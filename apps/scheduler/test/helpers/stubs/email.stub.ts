export interface RecordedEmail {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export class StubEmailService {
  public readonly sent: RecordedEmail[] = []
  public failNext = false

  send(opts: RecordedEmail): Promise<{ id: string | null; queued: boolean }> {
    if (this.failNext) {
      this.failNext = false
      return Promise.reject(new Error('stub email: failNext'))
    }
    this.sent.push(opts)
    return Promise.resolve({ id: `mock_${this.sent.length}`, queued: true })
  }

  reset() {
    this.sent.length = 0
    this.failNext = false
  }
}
