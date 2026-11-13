import sanitizeHtml from 'sanitize-html'

// Admin-written HTML shown to every merchant, so anything outside the
// composer's own output is dropped.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'h2',
    'h3',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'a',
  ],
  allowedAttributes: { a: ['href', 'rel', 'target'] },
  allowedSchemes: ['https', 'http', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
}

export function sanitizeBroadcastHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS)
}
