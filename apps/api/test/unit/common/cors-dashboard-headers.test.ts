import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { allowlistedCorsOptions } from '../../../src/common/http/cors-policy.js'

const client = readFileSync(
  join(__dirname, '../../../../../packages/web-shared/src/lib/merchant-api/client.ts'),
  'utf8',
)
const sent = [...new Set(client.match(/x-strimz-[a-z-]+/gu) ?? [])]
const allowed = allowlistedCorsOptions(['https://app.strimz.finance'], 'https://app.strimz.finance')
  .allowedHeaders as string[]

describe('the dashboard can send every header its API client sets', () => {
  it('finds the headers the client sets', () => {
    expect(sent).toContain('x-strimz-step-up')
  })

  it.each(sent)('allows %s from an allowlisted origin', (header) => {
    expect(allowed).toContain(header)
  })
})
