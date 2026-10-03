import { z } from 'zod'

export const CSP_REPORT_MAX_BYTES = 64 * 1024

const MAX_REPORTS_PER_BATCH = 100
const MAX_VALUE_LENGTH = 512

const LEGACY_MEDIA_TYPE = 'application/csp-report'
const REPORTING_API_MEDIA_TYPE = 'application/reports+json'

export interface CspViolation {
  format: 'report-uri' | 'report-to'
  documentUri: string
  blockedUri: string
  effectiveDirective: string
  disposition: string
  sourceFile: string | null
  lineNumber: number | null
  columnNumber: number | null
  statusCode: number | null
}

export type CspReportParseResult =
  | { ok: true; violations: CspViolation[] }
  | { ok: false; reason: 'unsupported_media_type' | 'invalid_json' | 'invalid_shape' }

const optionalString = z.string().nullish()
const optionalNumber = z.number().nullish()

const legacyReportSchema = z.object({
  'csp-report': z.object({
    'document-uri': z.string(),
    'blocked-uri': z.string(),
    'violated-directive': z.string(),
    'effective-directive': optionalString,
    disposition: optionalString,
    'source-file': optionalString,
    'line-number': optionalNumber,
    'column-number': optionalNumber,
    'status-code': optionalNumber,
  }),
})

const reportingApiViolationBodySchema = z.object({
  documentURL: z.string(),
  blockedURL: optionalString,
  effectiveDirective: z.string(),
  disposition: optionalString,
  sourceFile: optionalString,
  lineNumber: optionalNumber,
  columnNumber: optionalNumber,
  statusCode: optionalNumber,
})

const reportingApiEntrySchema = z.object({ type: z.string(), body: z.unknown() })

const reportingApiBatchSchema = z.array(reportingApiEntrySchema).max(MAX_REPORTS_PER_BATCH)

function mediaTypeOf(contentType: string | null): string | null {
  if (!contentType) return null
  return contentType.split(';')[0]?.trim().toLowerCase() ?? null
}

function truncate(value: string): string {
  return value.length > MAX_VALUE_LENGTH ? value.slice(0, MAX_VALUE_LENGTH) : value
}

function withoutQuery(value: string): string {
  if (!URL.canParse(value)) return truncate(value)
  const url = new URL(value)
  url.search = ''
  url.hash = ''
  return truncate(url.toString())
}

function optionalUrl(value: string | null | undefined): string | null {
  return value ? withoutQuery(value) : null
}

function parseJson(body: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(body) as unknown }
  } catch {
    return { ok: false }
  }
}

function parseLegacy(value: unknown): CspReportParseResult {
  const parsed = legacyReportSchema.safeParse(value)
  if (!parsed.success) return { ok: false, reason: 'invalid_shape' }
  const report = parsed.data['csp-report']
  return {
    ok: true,
    violations: [
      {
        format: 'report-uri',
        documentUri: withoutQuery(report['document-uri']),
        blockedUri: withoutQuery(report['blocked-uri']),
        effectiveDirective: truncate(report['effective-directive'] ?? report['violated-directive']),
        disposition: truncate(report.disposition ?? 'enforce'),
        sourceFile: optionalUrl(report['source-file']),
        lineNumber: report['line-number'] ?? null,
        columnNumber: report['column-number'] ?? null,
        statusCode: report['status-code'] ?? null,
      },
    ],
  }
}

function parseReportingApi(value: unknown): CspReportParseResult {
  const batch = reportingApiBatchSchema.safeParse(value)
  if (!batch.success) return { ok: false, reason: 'invalid_shape' }
  const violations: CspViolation[] = []
  for (const entry of batch.data) {
    if (entry.type !== 'csp-violation') continue
    const body = reportingApiViolationBodySchema.safeParse(entry.body)
    if (!body.success) return { ok: false, reason: 'invalid_shape' }
    violations.push({
      format: 'report-to',
      documentUri: withoutQuery(body.data.documentURL),
      blockedUri: withoutQuery(body.data.blockedURL ?? ''),
      effectiveDirective: truncate(body.data.effectiveDirective),
      disposition: truncate(body.data.disposition ?? 'enforce'),
      sourceFile: optionalUrl(body.data.sourceFile),
      lineNumber: body.data.lineNumber ?? null,
      columnNumber: body.data.columnNumber ?? null,
      statusCode: body.data.statusCode ?? null,
    })
  }
  return { ok: true, violations }
}

export function parseCspReport(contentType: string | null, body: string): CspReportParseResult {
  const mediaType = mediaTypeOf(contentType)
  if (mediaType !== LEGACY_MEDIA_TYPE && mediaType !== REPORTING_API_MEDIA_TYPE) {
    return { ok: false, reason: 'unsupported_media_type' }
  }
  const json = parseJson(body)
  if (!json.ok) return { ok: false, reason: 'invalid_json' }
  return mediaType === LEGACY_MEDIA_TYPE ? parseLegacy(json.value) : parseReportingApi(json.value)
}

export async function readCappedBody(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false }> {
  if (!stream) return { ok: true, text: '' }
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > maxBytes) {
      await reader.cancel()
      return { ok: false }
    }
    text += decoder.decode(value, { stream: true })
  }
  return { ok: true, text: text + decoder.decode() }
}
