import { Injectable, Logger } from '@nestjs/common'
import type { ContactRequestInput } from '@strimz/shared-types'
import { EmailService } from '../../infra/email/email.service.js'
import { TypedConfigService } from '../../config/index.js'

/** Human-friendly labels for the contact topic enum. */
const TOPIC_LABEL: Record<ContactRequestInput['topic'], string> = {
  sales: 'Sales',
  support: 'Support',
  partnership: 'Partnership',
  security: 'Security',
  other: 'Other',
}

@Injectable()
export class ContactService {
  private readonly log = new Logger(ContactService.name)

  constructor(
    private readonly email: EmailService,
    private readonly cfg: TypedConfigService,
  ) {}

  /**
   * Delivers the marketing-form message to the Strimz support inbox as
   * a transactional email via Resend. We route to `RESEND_REPLY_TO`
   * (`strimztokenstream@gmail.com` in dev) — the same address the
   * admin-facing emails already `replyTo` — so ops sees the full
   * incoming stream in one mailbox.
   *
   * The submitter's own address goes in the `replyTo` header so hitting
   * "reply" in Gmail responds to them directly.
   */
  async submit(input: ContactRequestInput): Promise<{ ok: true }> {
    const to = this.cfg.env.RESEND_REPLY_TO
    const html = renderContactHtml(input)
    const text = renderContactText(input)

    try {
      const result = await this.email.send({
        to,
        subject: `[${TOPIC_LABEL[input.topic]}] ${input.name} — Strimz contact form`,
        html,
        text,
        replyTo: input.email,
      })
      this.log.log(
        `contact form submitted: from=${input.email} topic=${input.topic} resendId=${result.id ?? 'stub'} queued=${result.queued}`,
      )
    } catch (err) {
      this.log.error(
        `contact form email failed: ${(err as Error).message}. from=${input.email} topic=${input.topic}`,
      )
      // Deliberately do NOT rethrow. The submitter shouldn't see an
      // "email failed" 5xx just because Resend is temporarily
      // unavailable — a message we've logged is still recoverable.
    }

    return { ok: true }
  }
}

function renderContactHtml(input: ContactRequestInput): string {
  const rows: Array<[label: string, value: string]> = [
    ['Name', input.name],
    ['Email', input.email],
    ['Company', input.company ?? '—'],
    ['Topic', TOPIC_LABEL[input.topic]],
  ]
  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;color:#58556A;font-size:13px;">${label}</td><td style="padding:8px 12px;color:#050020;font-weight:500;">${escapeHtml(value)}</td></tr>`,
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;color:#050020;padding:24px;">
  <h2 style="margin:0 0 12px;font-size:16px;">New Strimz contact form message</h2>
  <table style="border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">${rowHtml}</table>
  <h3 style="margin:20px 0 8px;font-size:14px;color:#050020;">Message</h3>
  <div style="white-space:pre-wrap;color:#050020;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.55;">${escapeHtml(input.message)}</div>
</body>
</html>`.trim()
}

function renderContactText(input: ContactRequestInput): string {
  return [
    `Topic: ${TOPIC_LABEL[input.topic]}`,
    `Name:  ${input.name}`,
    `Email: ${input.email}`,
    input.company ? `Company: ${input.company}` : null,
    '',
    input.message,
  ]
    .filter((l): l is string => l !== null)
    .join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
