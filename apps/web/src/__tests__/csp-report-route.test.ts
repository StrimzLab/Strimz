import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { POST } from '../app/api/csp-report/route'

const URL_ = 'https://strimz.finance/api/csp-report'

function legacyReport(blocked: string): string {
  return JSON.stringify({
    'csp-report': {
      'document-uri': 'https://strimz.finance/login',
      'violated-directive': 'script-src-elem',
      'effective-directive': 'script-src-elem',
      'original-policy': "default-src 'self'",
      disposition: 'report',
      'blocked-uri': blocked,
      'status-code': 200,
    },
  })
}

function reportingApiBatch(count: number): string {
  return JSON.stringify(
    Array.from({ length: count }, (_, i) => ({
      type: 'csp-violation',
      age: 0,
      url: 'https://strimz.finance/pay/ps_1',
      user_agent: 'Mozilla/5.0',
      body: {
        documentURL: 'https://strimz.finance/pay/ps_1',
        blockedURL: `https://cdn${i}.example/a.js`,
        effectiveDirective: 'script-src-elem',
        originalPolicy: "default-src 'self'",
        disposition: 'report',
        statusCode: 200,
      },
    })),
  )
}

function post(body: string, contentType: string, headers: Record<string, string> = {}): Request {
  return new Request(URL_, {
    method: 'POST',
    headers: { 'content-type': contentType, ...headers },
    body,
  })
}

describe('POST /api/csp-report', () => {
  let warn: MockInstance<typeof console.warn>

  function logged(event: string): string[] {
    return warn.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => (JSON.parse(line) as { event?: string }).event === event)
  }

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs a legacy report as one structured line and returns 204 with no body', async () => {
    const res = await POST(
      post(legacyReport('https://evil.example/x.js'), 'application/csp-report'),
    )
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(warn).toHaveBeenCalledTimes(1)
    const line = logged('csp_violation')[0]
    expect(line).not.toContain('\n')
    expect(JSON.parse(String(line))).toMatchObject({
      event: 'csp_violation',
      format: 'report-uri',
      documentUri: 'https://strimz.finance/login',
      blockedUri: 'https://evil.example/x.js',
      effectiveDirective: 'script-src-elem',
    })
  })

  it('logs one line per violation in a Reporting API batch', async () => {
    const res = await POST(post(reportingApiBatch(3), 'application/reports+json'))
    expect(res.status).toBe(204)
    expect(logged('csp_violation')).toHaveLength(3)
  })

  it('keeps a hostile value inside one JSON log line', async () => {
    const res = await POST(
      post(legacyReport('https://evil.example/\n{"event":"forged"}'), 'application/csp-report'),
    )
    expect(res.status).toBe(204)
    expect(logged('csp_violation')).toHaveLength(1)
    expect(logged('csp_violation')[0]).not.toContain('\n')
  })

  it('refuses an unsupported content type with 415 and does not echo the body', async () => {
    const res = await POST(post(legacyReport('<script>x</script>'), 'text/plain'))
    expect(res.status).toBe(415)
    expect(await res.text()).toBe('')
    expect(logged('csp_violation')).toHaveLength(0)
  })

  it('refuses malformed JSON with 400 and does not echo the body', async () => {
    const res = await POST(post('{"csp-report": <script>', 'application/csp-report'))
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('')
    expect(logged('csp_violation')).toHaveLength(0)
  })

  it('refuses a body of the wrong shape with 400', async () => {
    const res = await POST(post(JSON.stringify({ hello: 'world' }), 'application/csp-report'))
    expect(res.status).toBe(400)
    expect(logged('csp_violation')).toHaveLength(0)
  })

  it('refuses a declared oversized body with 413', async () => {
    const res = await POST(
      post('{}', 'application/csp-report', { 'content-length': String(1024 * 1024) }),
    )
    expect(res.status).toBe(413)
    expect(await res.text()).toBe('')
    expect(logged('csp_violation')).toHaveLength(0)
  })

  it('refuses an oversized body that does not declare its length with 413', async () => {
    const res = await POST(post(`"${'a'.repeat(70 * 1024)}"`, 'application/csp-report'))
    expect(res.status).toBe(413)
    expect(logged('csp_violation')).toHaveLength(0)
  })

  it('records a rejected report without its content', async () => {
    await POST(post('{"secret":"do-not-log"', 'application/csp-report'))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(logged('csp_report_rejected')).toHaveLength(1)
    expect(String(warn.mock.calls[0]?.[0])).not.toContain('do-not-log')
  })
})
