const DAY_MS = 86_400_000

export type ForecastConfidence = 'low' | 'medium' | 'high'

export interface RevenueForecast {
  confidence: ForecastConfidence
  next30: bigint
  next60: bigint
  next90: bigint
}

export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function forecastDailyRevenue(
  daily: ReadonlyMap<string, bigint>,
  lastDay: string,
): RevenueForecast {
  const revenueDays = daily.size
  if (revenueDays < 7) {
    return { confidence: 'low', next30: 0n, next60: 0n, next90: 0n }
  }
  const firstDay = [...daily.keys()].sort()[0] as string
  if (firstDay > lastDay) {
    throw new Error(`revenue day ${firstDay} is after the last forecast day ${lastDay}`)
  }
  const ys: number[] = []
  for (
    let day = Date.parse(`${firstDay}T00:00:00.000Z`);
    day <= Date.parse(`${lastDay}T00:00:00.000Z`);
    day += DAY_MS
  ) {
    ys.push(Number(daily.get(utcDayKey(new Date(day))) ?? 0n))
  }
  const { slope, intercept } = linearRegression(ys)
  const project = (days: number): bigint => {
    let total = 0
    for (let k = 0; k < days; k++) {
      total += Math.max(0, slope * (ys.length + k) + intercept)
    }
    return BigInt(Math.round(total))
  }
  return {
    confidence: revenueDays >= 60 ? 'high' : revenueDays >= 30 ? 'medium' : 'low',
    next30: project(30),
    next60: project(60),
    next90: project(90),
  }
}

function linearRegression(ys: readonly number[]): { slope: number; intercept: number } {
  const n = ys.length
  const sumX = (n * (n - 1)) / 2
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = ys.reduce((acc, y, x) => acc + x * y, 0)
  const sumXX = ys.reduce((acc, _y, x) => acc + x * x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n }
  const slope = (n * sumXY - sumX * sumY) / denom
  return { slope, intercept: (sumY - slope * sumX) / n }
}
