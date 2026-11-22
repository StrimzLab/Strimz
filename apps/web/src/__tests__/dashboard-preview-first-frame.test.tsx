import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DashboardPreview } from '@/components/marketing/home/dashboard-preview'

// #496: the preview rendered an empty window until JavaScript started its timers.
describe('dashboard preview first frame', () => {
  const html = renderToString(<DashboardPreview />)

  it('arrives from the server with the subscription scene complete', () => {
    for (const text of ['Brightline Studio', '$20.00 USDC', 'Last 7 charges', '7 times']) {
      expect(html).toContain(text)
    }
  })

  it('has nothing waiting to fade in', () => {
    expect(html).not.toMatch(/opacity:\s*0[;"]/u)
  })
  // #496 (Lighthouse): its "Subscriptions" h3 came straight after the page's h1.
  it('is a decorative mock-up: hidden from screen readers, with no headings', () => {
    expect(html).toMatch(/^<div[^>]*aria-hidden="true"/u)
    expect(html).not.toMatch(/<h[1-6][\s>]/u)
  })
})
