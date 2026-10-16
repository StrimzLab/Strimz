import { CSP_REPORT_MAX_BYTES, parseCspReport, readCappedBody } from '@/lib/csp-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function empty(status: number): Response {
  return new Response(null, { status })
}

function rejected(status: number, reason: string): Response {
  console.warn(JSON.stringify({ event: 'csp_report_rejected', status, reason }))
  return empty(status)
}

export async function POST(req: Request): Promise<Response> {
  const declaredLength = Number(req.headers.get('content-length') ?? '0')
  if (declaredLength > CSP_REPORT_MAX_BYTES) return rejected(413, 'too_large')

  const body = await readCappedBody(req.body, CSP_REPORT_MAX_BYTES)
  if (!body.ok) return rejected(413, 'too_large')

  const parsed = parseCspReport(req.headers.get('content-type'), body.text)
  if (!parsed.ok) {
    return rejected(parsed.reason === 'unsupported_media_type' ? 415 : 400, parsed.reason)
  }

  for (const violation of parsed.violations) {
    console.warn(JSON.stringify({ event: 'csp_violation', ...violation }))
  }
  return empty(204)
}
