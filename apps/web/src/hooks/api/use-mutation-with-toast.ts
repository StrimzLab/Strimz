'use client'

import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { toast } from 'sonner'

import {
  isAuthError,
  isNotFound,
  isValidation,
  type StrimzApiError,
} from '@/lib/merchant-api/errors'

/**
 * Standard messages a mutation surfaces through sonner. Three states
 * the merchant should see for any non-trivial server action.
 */
export interface MutationToastMessages<TInput, TResult> {
  /** Shown while the request is in flight. Omit to skip the loading toast. */
  loading?: string | ((input: TInput) => string)
  /** Shown after success. Omit to skip a success toast (rare). */
  success: string | ((result: TResult, input: TInput) => string)
  /**
   * Shown after failure. Defaults to a sensible fallback derived from
   * the API error code (`Validation failed`, `Unauthorized`, etc.).
   * Pass a string/function to override.
   */
  error?: string | ((error: unknown, input: TInput) => string)
}

/**
 * Internal wrapper context. Combines what the caller returns from
 * `onMutate` (their cache snapshot, for rollback) with the sonner toast
 * id we hold across the lifecycle.
 */
type WithToastContext<T> = T & { toastId?: string | number }

/**
 * Wraps `useMutation` to attach a sonner loading→success/error toast
 * lifecycle. Returns the same mutation object. UI code keeps using
 * `mutation.mutate(...)`, `mutation.isPending`, `mutation.data`.
 *
 * Why a wrapper rather than threading toast calls per hook:
 *   - Centralised error→message mapping. The `StrimzApiError` subclasses
 *     are mapped to copy in one place; per-hook code branches on
 *     `instanceof` only when it needs custom behaviour beyond toast.
 *   - Loading→success/error transitions are paired via sonner's id-based
 *     toast handle. Without the wrapper every hook would re-implement
 *     the same `toast.loading()` → `toast.success(..., {id})` dance.
 *
 * Re-render hygiene:
 *   - The `messages` object can be reconstructed every render; we
 *     capture it in a ref so the mutation callbacks don't churn
 *     identity and TanStack Query doesn't drop in-flight state.
 *
 * Compatibility:
 *   - Targets TanStack Query 5.100+ callback signatures
 *     (`onMutate(variables, mutationCtx)`,
 *     `onSuccess(data, variables, onMutateResult, mutationCtx)`).
 */
export function useMutationWithToast<TResult, TInput, TOnMutateResult = unknown>(
  options: UseMutationOptions<TResult, Error, TInput, TOnMutateResult> & {
    messages: MutationToastMessages<TInput, TResult>
  },
) {
  const { messages, onMutate, onSuccess, onError, onSettled, ...rest } = options

  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const resolve = useCallback(
    <T extends string>(
      msg: T | ((...args: never[]) => T) | undefined,
      args: unknown[],
    ): T | undefined => {
      if (typeof msg === 'function') return (msg as (...a: unknown[]) => T)(...args)
      return msg
    },
    [],
  )

  // Re-typed callbacks so our wrapper's context shape includes `toastId`
  // without forcing every consumer's onMutate to declare it.
  type Ctx = WithToastContext<TOnMutateResult>

  return useMutation<TResult, Error, TInput, Ctx>({
    ...(rest as UseMutationOptions<TResult, Error, TInput, Ctx>),
    onMutate: async (variables, mutationCtx) => {
      const loadingMsg = resolve(messagesRef.current.loading, [variables])
      const toastId = loadingMsg ? toast.loading(loadingMsg) : undefined

      // Forward to the caller's onMutate so optimistic cache snapshots
      // are captured. Cast through `as` because we widen the context
      // shape to include `toastId` ,  TS can't infer the caller's exact
      // TOnMutateResult through the wrapper.
      const userResult = (await (onMutate as typeof options.onMutate | undefined)?.(
        variables,
        mutationCtx,
      )) as TOnMutateResult | undefined
      return { ...(userResult ?? ({} as TOnMutateResult)), toastId } as Ctx
    },
    onSuccess: (data, variables, onMutateResult, mutationCtx) => {
      const successMsg = resolve(messagesRef.current.success, [data, variables])
      if (onMutateResult?.toastId !== undefined) {
        toast.success(successMsg, { id: onMutateResult.toastId })
      } else if (successMsg) {
        toast.success(successMsg)
      }
      ;(onSuccess as typeof options.onSuccess | undefined)?.(
        data,
        variables,
        onMutateResult as TOnMutateResult,
        mutationCtx,
      )
    },
    onError: (error, variables, onMutateResult, mutationCtx) => {
      const explicit = resolve(messagesRef.current.error, [error, variables])
      const description = describeError(error)
      const message = explicit ?? defaultErrorMessage(error)
      if (onMutateResult?.toastId !== undefined) {
        toast.error(message, { id: onMutateResult.toastId, description })
      } else {
        toast.error(message, { description })
      }
      ;(onError as typeof options.onError | undefined)?.(
        error,
        variables,
        onMutateResult as TOnMutateResult | undefined,
        mutationCtx,
      )
    },
    onSettled: (data, error, variables, onMutateResult, mutationCtx) => {
      ;(onSettled as typeof options.onSettled | undefined)?.(
        data,
        error,
        variables,
        onMutateResult as TOnMutateResult | undefined,
        mutationCtx,
      )
    },
  })
}

/**
 * Maps known error subclasses to user-readable copy. Reaches into
 * `StrimzApiError.code` for codes we don't subclass (5xx, network).
 */
function defaultErrorMessage(error: unknown): string {
  if (isAuthError(error)) return 'Your session expired. Please sign in again.'
  if (isNotFound(error)) return 'That resource no longer exists.'
  if (isValidation(error)) return 'Please check the highlighted fields and try again.'
  if (error && typeof error === 'object' && 'status' in error) {
    const e = error as StrimzApiError
    if (e.status === 429) return "You're going too fast. Try again in a moment."
    if (e.status >= 500) return 'Strimz is having trouble. We’re on it.'
  }
  return 'Something went wrong.'
}

/**
 * Sub-line of the error toast. We use it for the raw server message ,
 * helps support diagnose without forcing the merchant to read a code.
 */
function describeError(error: unknown): string | undefined {
  if (error instanceof Error && error.message) return error.message
  return undefined
}
