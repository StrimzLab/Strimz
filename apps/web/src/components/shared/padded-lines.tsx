import { cn } from '@strimz/ui'

/**
 * Three stacked accent bars used as a visual cap below the marketing
 * footer (and sometimes between sections). Direct match to
 * strimz-subscription's `paddedLines` component.
 */
export function PaddedLines({ className }: { className?: string }) {
  return (
    <div className={cn('w-full', className)} aria-hidden>
      <div className="bg-accent h-[10px] w-full" />
      <div className="bg-accent-bright h-[10px] w-full" />
      <div className="bg-accent-soft h-[10px] w-full" />
    </div>
  )
}
