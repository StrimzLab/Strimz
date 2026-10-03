import type { RelaySubmissionView } from '@/lib/strimz-bff'

const LIVE_STATUSES: ReadonlySet<RelaySubmissionView['status']> = new Set([
  'queued',
  'signing',
  'broadcast',
])

export function inProgressSubmission(body: unknown): RelaySubmissionView | null {
  const error = (body as { detail?: { error?: unknown } } | null)?.detail?.error as
    | { code?: unknown; details?: { submission?: RelaySubmissionView | null } }
    | undefined
  if (error?.code !== 'attempt_in_progress') return null
  const submission = error.details?.submission
  if (!submission || !LIVE_STATUSES.has(submission.status)) return null
  return submission
}
