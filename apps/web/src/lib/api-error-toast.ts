import { isAuthError, isNotFound, isValidation, StrimzApiError } from '@/lib/merchant-api/errors'

export interface ApiErrorToast {
  title: string
  description?: string
}

export function apiErrorToast(error: unknown): ApiErrorToast {
  return { title: titleFor(error), description: describe(error) }
}

function titleFor(error: unknown): string {
  if (isAuthError(error)) return 'Your session expired. Please sign in again.'
  if (isNotFound(error)) return 'That resource no longer exists.'
  if (isValidation(error)) return 'Please check the highlighted fields and try again.'
  if (error instanceof StrimzApiError) {
    if (error.status === 429) return "You're going too fast. Try again in a moment."
    if (error.status >= 500) return 'Strimz is having trouble. We’re on it.'
  }
  return 'Something went wrong.'
}

function describe(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.message) return undefined
  if (error instanceof StrimzApiError && error.requestId) {
    return `${error.message} (ref ${error.requestId})`
  }
  return error.message
}
