import { cn } from '@strimz/ui'

/** The brand's three green bars, used under the navy band on the homepage. */
export function PaddedLines({ className }: { className?: string }) {
  return (
    <div className={cn('w-full', className)} aria-hidden>
      <div className="bg-accent h-[10px] w-full" />
      <div className="bg-accent-bright h-[10px] w-full" />
      <div className="bg-accent-soft h-[10px] w-full" />
    </div>
  )
}
