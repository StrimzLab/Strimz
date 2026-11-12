import { describe, expect, it } from 'vitest'
import { LOGO_URL, STRIMZ_ORIGIN, WelcomeEmail, renderToHtml } from '@strimz/email-templates'

describe('email links', () => {
  it('loads the logo from strimz.finance', () => {
    expect(LOGO_URL).toBe('https://strimz.finance/logo/blueLogo.png')
  })

  it('sends dashboard links to strimz.finance when no override is set', () => {
    expect(STRIMZ_ORIGIN).toBe('https://strimz.finance')
  })

  it('renders no Vercel preview links', async () => {
    const html = await renderToHtml(WelcomeEmail(WelcomeEmail.PreviewProps))
    expect(html).toContain('https://strimz.finance/logo/blueLogo.png')
    expect(html).not.toMatch(/vercel\.app/u)
  })
})
