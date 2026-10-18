'use client'

import { useEffect, useReducer } from 'react'
import copyIcon from '@iconify-icons/solar/copy-linear'
import checkIcon from '@iconify-icons/solar/check-read-linear'
import dangerIcon from '@iconify-icons/solar/danger-triangle-linear'
import { cn } from '@strimz/ui'
import { MkIcon } from '../icon'
import { copyReducer } from '../state'
import { toast } from '../toast/store'

const ICONS = { idle: copyIcon, copying: copyIcon, copied: checkIcon, failed: dangerIcon } as const
const LABELS = {
  idle: 'Copy',
  copying: 'Copying',
  copied: 'Copied',
  failed: 'Copy failed',
} as const

export function CopyButton({
  text,
  label,
  className,
}: {
  text: string
  label: string
  className?: string
}) {
  const [state, dispatch] = useReducer(copyReducer, { status: 'idle' })

  useEffect(() => {
    if (state.status !== 'copied' && state.status !== 'failed') return
    const t = setTimeout(() => dispatch({ type: 'reset' }), 2200)
    return () => clearTimeout(t)
  }, [state.status])

  const copy = async () => {
    dispatch({ type: 'start' })
    try {
      if (!navigator.clipboard) throw new Error('This browser has no clipboard access here.')
      await navigator.clipboard.writeText(text)
      dispatch({ type: 'done' })
      toast.success(`${label} copied`, { id: 'copy' })
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'The clipboard refused the request.'
      dispatch({ type: 'fail', reason })
      toast.error(`Couldn't copy ${label.toLowerCase()}`, {
        id: 'copy',
        description: `${reason} Select the text and copy it yourself.`,
      })
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={state.status === 'copying'}
      aria-label={`${LABELS[state.status]}: ${label}`}
      className={cn(
        'focus-visible:ring-accent grid size-9 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60',
        state.status === 'copied' && 'text-accent',
        state.status === 'failed' && 'text-destructive',
        className,
      )}
    >
      <MkIcon icon={ICONS[state.status]} className="size-[18px]" />
    </button>
  )
}
