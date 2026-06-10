import { Injectable, Logger } from '@nestjs/common'
import { Resend } from 'resend'
import { TypedConfigService } from '../../config/index.js'

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  /** Optional plaintext fallback. */
  text?: string
  /** Overrides the default RESEND_REPLY_TO. */
  replyTo?: string | string[]
}

/**
 * Thin Resend wrapper for HTTP handlers in apps/api — currently the
 * admin-invite path; built with room to grow.
 *
 *   - `from` is fixed to `RESEND_FROM_EMAIL` and not caller-overridable.
 *     Resend rejects any from-domain outside the verified subdomain;
 *     the only sender we use is `noreply@mail.strimz.finance`.
 *   - `replyTo` defaults to `RESEND_REPLY_TO` (Strimz support inbox)
 *     so a recipient hitting Reply lands in a human inbox rather than
 *     bouncing off `noreply@`.
 *   - In stub mode (no `RESEND_API_KEY`) we log and return. Callers
 *     treat a stubbed send as "delivery was a no-op but the action
 *     succeeded" — for the admin invite, the row is created either
 *     way so the operator can hand-deliver in dev.
 */
@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name)
  private readonly resend: Resend | null
  private readonly fromEmail: string
  private readonly defaultReplyTo: string

  constructor(cfg: TypedConfigService) {
    this.fromEmail = cfg.env.RESEND_FROM_EMAIL
    this.defaultReplyTo = cfg.env.RESEND_REPLY_TO
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
      replyTo: options.replyTo ?? this.defaultReplyTo,
    })
    if (error) {
      this.log.error(`resend error: ${error.message}`)
      throw error
    }
    return { id: data?.id ?? null, queued: true }
  }
}
