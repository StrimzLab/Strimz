import { parseArcEnvironment, type ArcEnvironment } from './chains.js'

export const TEST_MODE_EMAIL_NOTE =
  'Sent from Strimz test mode on Arc testnet. No real money moved.'

const SUBJECT_PREFIX = '[Test] '
const NOTE_HTML = `<p style="margin:0 0 16px;padding:10px 14px;border-radius:8px;background:#f1f2f6;color:#3b3b4f;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5">${TEST_MODE_EMAIL_NOTE}</p>`

interface Email {
  subject: string
  html: string
  text?: string
}

/** Labels an email sent from the testnet deployment; mainnet emails pass through unchanged. */
export function markTestModeEmail<T extends Email>(environment: ArcEnvironment, email: T): T {
  if (parseArcEnvironment(environment) !== 'testnet') return email
  if (email.subject.startsWith(SUBJECT_PREFIX)) return email
  const body = /<body[^>]*>/iu
  return {
    ...email,
    subject: SUBJECT_PREFIX + email.subject,
    html: body.test(email.html)
      ? email.html.replace(body, (tag) => tag + NOTE_HTML)
      : NOTE_HTML + email.html,
    text: email.text === undefined ? undefined : `${TEST_MODE_EMAIL_NOTE}\n\n${email.text}`,
  }
}
