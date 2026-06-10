import { Injectable, Logger } from '@nestjs/common'
import { Resend } from 'resend'
import { TypedConfigService } from '../../config/index.js'

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  /** Overrides the default RESEND_REPLY_TO. */
  replyTo?: string | string[]
}

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

  /**
   * Sends a transactional email via Resend.
   *
   * - `from` is fixed to `RESEND_FROM_EMAIL` (`noreply@mail.strimz.finance`).
   *   Resend requires the from-domain to match the verified subdomain;
   *   we don't allow callers to override this.
   * - `replyTo` defaults to `RESEND_REPLY_TO` (the Strimz support
   *   mailbox) so a merchant hitting Reply lands in a human inbox.
   *   Callers can override per-send (e.g. ops alerts may want
   *   replies to the admin alert address itself).
   * - In stub mode (no API key) we log and return — the caller's
   *   one-shot stamp (e.g. `merchantNotifiedAt`) should still be
   *   applied so we don't loop. Callers detect stub mode via
   *   `queued === false`.
   */
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
