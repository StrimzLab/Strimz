import { cn } from '@strimz/ui'

/**
 * Three stacked accent bars used as a visual cap below the marketing
 * footer (and sometimes between sections). Direct match to
 * strimz-subscription's `paddedLines` component.
 */
export function PaddedLines({ className }: { className?: string }) {
  return (
    <div className={cn('w-full', className)} aria-hidden>
      <div className="h-[10px] w-full bg-[#02C76A]" />
      <div className="h-[10px] w-full bg-[#03FC86]" />
      <div className="h-[10px] w-full bg-[#95FECC]" />
    </div>
  )
}
