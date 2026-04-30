import { Injectable, Logger } from '@nestjs/common'
import { Resend } from 'resend'
import { TypedConfigService } from '../../config/index.js'

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  /** Optional plaintext fallback. */
  text?: string
}

@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name)
  private readonly resend: Resend | null
  private readonly fromEmail: string

  constructor(cfg: TypedConfigService) {
    this.fromEmail = cfg.env.RESEND_FROM_EMAIL ?? 'noreply@strimz.io'
    this.resend = cfg.env.RESEND_API_KEY ? new Resend(cfg.env.RESEND_API_KEY) : null
    if (!this.resend) {
      this.log.warn('RESEND_API_KEY not set — emails will be logged only')
    }
  }

  async send(options: SendEmailOptions): Promise<{ id: string | null; queued: boolean }> {
    if (!this.resend) {
      this.log.log(`[email-stub] to=${options.to} subject=${options.subject}`)
      return { id: null, queued: false }
    }
    const { data, error } = await this.resend.emails.send({
      from: this.fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })
    if (error) {
      this.log.error(`resend error: ${error.message}`)
      throw error
    }
    return { id: data?.id ?? null, queued: true }
  }
}
