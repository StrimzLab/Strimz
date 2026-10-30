/** Formats a unix timestamp (seconds) as "1 Nov 2026, 12:00 UTC". */
export function formatUtc(unixSeconds: number): string {
  const text = new Date(unixSeconds * 1000).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
  return `${text} UTC`
}
