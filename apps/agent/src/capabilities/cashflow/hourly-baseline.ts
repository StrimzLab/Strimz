const HOUR_MS = 60 * 60 * 1_000
const DAY_MS = 24 * HOUR_MS

export function utcHourFloor(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()))
}

export function sameHourBaseline(input: {
  hourStart: Date
  firstActivityAt: Date | null
  revenueByHour: ReadonlyMap<string, bigint>
  days: number
}): bigint[] {
  if (input.firstActivityAt === null) return []
  const firstHour = utcHourFloor(input.firstActivityAt).getTime()
  const samples: bigint[] = []
  for (let d = 1; d <= input.days; d++) {
    const slot = new Date(input.hourStart.getTime() - d * DAY_MS)
    if (slot.getTime() < firstHour) break
    samples.push(input.revenueByHour.get(slot.toISOString()) ?? 0n)
  }
  return samples
}

export function meanAndStddev(samples: readonly bigint[]): { mean: number; stddev: number } {
  if (samples.length === 0) return { mean: 0, stddev: 0 }
  const values = samples.map(Number)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  return { mean, stddev: Math.sqrt(variance) }
}
