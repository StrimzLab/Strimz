import { describe, expect, it } from 'vitest'
import { escapeHtml } from '../../src/common/escape-html.js'

describe('escapeHtml', () => {
  it('escapes every character that can break out of HTML text or an attribute', () => {
    expect(escapeHtml(`<a href="x" title='y'>Tom & Co</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Co&lt;/a&gt;',
    )
  })

  it('does not double-decode an already escaped ampersand', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Acme Ltd 2026')).toBe('Acme Ltd 2026')
  })
})
