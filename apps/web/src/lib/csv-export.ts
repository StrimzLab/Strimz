'use client'

import Papa from 'papaparse'

/**
 * Trigger a browser download of an arbitrary row set as CSV.
 * Pass `columns` to override which fields appear and in what order.
 */
export function downloadCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns?: { key: keyof T & string; header: string }[],
): void {
  const fields = columns ? columns.map((c) => c.key) : rows[0] ? Object.keys(rows[0]) : []
  const headers = columns ? columns.map((c) => c.header) : fields

  const data = rows.map((row) =>
    fields.reduce<Record<string, unknown>>((acc, key, i) => {
      acc[headers[i]!] = row[key]
      return acc
    }, {}),
  )

  const csv = Papa.unparse(data, { quotes: true })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
