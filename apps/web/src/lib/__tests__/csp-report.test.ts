import { describe, expect, it } from 'vitest'
import { CSP_REPORT_MAX_BYTES, parseCspReport, readCappedBody } from '../csp-report'

const LEGACY = 'application/csp-report'
const REPORTING_API = 'application/reports+json'

function legacyBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    'csp-report': {
      'document-uri': 'https://strimz.finance/pay/ps_123?embed=1#top',
      referrer: '',
      'violated-directive': 'script-src-elem',
      'effective-directive': 'script-src-elem',
      'original-policy': "default-src 'self'",
      disposition: 'report',
      'blocked-uri': 'https://evil.example/x.js?token=secret',
      'line-number': 12,
      'column-number': 4,
      'source-file': 'https://strimz.finance/_next/static/chunks/app.js',
      'status-code': 200,
      'script-sample': 'alert(document.cookie)',
      ...overrides,
    },
  })
}

function reportingApiBody(entries: unknown[]): string {
  return JSON.stringify(entries)
}

const REPORTING_API_VIOLATION = {
  type: 'csp-violation',
  age: 10,
  url: 'https://strimz.finance/app?code=oauth-code',
  user_agent: 'Mozilla/5.0',
  body: {
    documentURL: 'https://strimz.finance/app?code=oauth-code',
    referrer: '',
    blockedURL: 'wss://relay.example.org/socket?projectId=abc',
    effectiveDirective: 'connect-src',
    originalPolicy: "default-src 'self'",
    sourceFile: null,
    sample: '',
    disposition: 'report',
    statusCode: 200,
    lineNumber: null,
    columnNumber: null,
  },
}

describe('parseCspReport', () => {
  it('reads a legacy report-uri body', () => {
    const result = parseCspReport(LEGACY, legacyBody())
    expect(result).toEqual({
      ok: true,
      violations: [
        {
          format: 'report-uri',
          documentUri: 'https://strimz.finance/pay/ps_123',
          blockedUri: 'https://evil.example/x.js',
          effectiveDirective: 'script-src-elem',
          disposition: 'report',
          sourceFile: 'https://strimz.finance/_next/static/chunks/app.js',
          lineNumber: 12,
          columnNumber: 4,
          statusCode: 200,
        },
      ],
    })
  })

  it('falls back to violated-directive when effective-directive is missing', () => {
    const result = parseCspReport(
      LEGACY,
      legacyBody({ 'effective-directive': undefined, 'violated-directive': 'img-src' }),
    )
    expect(result.ok && result.violations[0]?.effectiveDirective).toBe('img-src')
  })

  it('keeps keyword blocked values such as inline and eval as they are', () => {
    const result = parseCspReport(LEGACY, legacyBody({ 'blocked-uri': 'inline' }))
    expect(result.ok && result.violations[0]?.blockedUri).toBe('inline')
  })

  it('reads a Reporting API batch and drops query strings', () => {
    const result = parseCspReport(REPORTING_API, reportingApiBody([REPORTING_API_VIOLATION]))
    expect(result).toEqual({
      ok: true,
      violations: [
        {
          format: 'report-to',
          documentUri: 'https://strimz.finance/app',
          blockedUri: 'wss://relay.example.org/socket',
          effectiveDirective: 'connect-src',
          disposition: 'report',
          sourceFile: null,
          lineNumber: null,
          columnNumber: null,
          statusCode: 200,
        },
      ],
    })
  })

  it('ignores Reporting API entries that are not CSP violations', () => {
    const result = parseCspReport(
      REPORTING_API,
      reportingApiBody([
        { type: 'deprecation', age: 1, url: 'https://strimz.finance/', body: { id: 'x' } },
        REPORTING_API_VIOLATION,
      ]),
    )
    expect(result.ok && result.violations).toHaveLength(1)
  })

  it('accepts a content type with parameters', () => {
    const result = parseCspReport('application/csp-report; charset=utf-8', legacyBody())
    expect(result.ok).toBe(true)
  })

  it('never carries the script sample or the original policy', () => {
    const result = parseCspReport(LEGACY, legacyBody())
    expect(JSON.stringify(result)).not.toContain('document.cookie')
    expect(JSON.stringify(result)).not.toContain('original')
  })

  it('truncates very long values', () => {
    const long = `https://strimz.finance/${'a'.repeat(5000)}`
    const result = parseCspReport(LEGACY, legacyBody({ 'document-uri': long }))
    expect(result.ok && result.violations[0]?.documentUri.length).toBeLessThanOrEqual(512)
  })

  it('rejects an unsupported content type', () => {
    expect(parseCspReport('application/json', legacyBody())).toEqual({
      ok: false,
      reason: 'unsupported_media_type',
    })
    expect(parseCspReport(null, legacyBody())).toEqual({
      ok: false,
      reason: 'unsupported_media_type',
    })
  })

  it('rejects a body that is not JSON', () => {
    expect(parseCspReport(LEGACY, '{not json')).toEqual({ ok: false, reason: 'invalid_json' })
  })

  it('rejects a legacy body without the csp-report envelope', () => {
    expect(parseCspReport(LEGACY, JSON.stringify({ 'document-uri': 'x' }))).toEqual({
      ok: false,
      reason: 'invalid_shape',
    })
  })

  it('rejects a legacy body missing required fields', () => {
    expect(parseCspReport(LEGACY, legacyBody({ 'document-uri': 42 }))).toEqual({
      ok: false,
      reason: 'invalid_shape',
    })
  })

  it('rejects a Reporting API body that is not an array', () => {
    expect(parseCspReport(REPORTING_API, JSON.stringify(REPORTING_API_VIOLATION))).toEqual({
      ok: false,
      reason: 'invalid_shape',
    })
  })

  it('rejects a Reporting API violation with a malformed body', () => {
    expect(
      parseCspReport(
        REPORTING_API,
        reportingApiBody([{ ...REPORTING_API_VIOLATION, body: { documentURL: 1 } }]),
      ),
    ).toEqual({ ok: false, reason: 'invalid_shape' })
  })

  it('rejects an oversized Reporting API batch', () => {
    const batch = Array.from({ length: 101 }, () => REPORTING_API_VIOLATION)
    expect(parseCspReport(REPORTING_API, reportingApiBody(batch))).toEqual({
      ok: false,
      reason: 'invalid_shape',
    })
  })
})

describe('readCappedBody', () => {
  function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    })
  }

  it('returns the body when it fits', async () => {
    await expect(readCappedBody(streamOf('{"a":', '1}'), 64)).resolves.toEqual({
      ok: true,
      text: '{"a":1}',
    })
  })

  it('returns an empty body for a missing stream', async () => {
    await expect(readCappedBody(null, 64)).resolves.toEqual({ ok: true, text: '' })
  })

  it('stops reading once the cap is passed', async () => {
    await expect(readCappedBody(streamOf('a'.repeat(40), 'b'.repeat(40)), 64)).resolves.toEqual({
      ok: false,
    })
  })

  it('caps report bodies at 64 KiB', () => {
    expect(CSP_REPORT_MAX_BYTES).toBe(64 * 1024)
  })
})
