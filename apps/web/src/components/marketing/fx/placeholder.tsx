import { Skeleton, cn } from '@strimz/ui'

// Placeholder shapes in the style of Skeleton's Tailwind placeholders: lines, circles and blocks that pulse.
export function PlaceholderLine({ className }: { className?: string }) {
  return <Skeleton className={cn('h-4 rounded-full', className)} />
}

export function PlaceholderCircle({ className }: { className?: string }) {
  return <Skeleton className={cn('size-12 rounded-full', className)} />
}

export function PlaceholderBlock({ className }: { className?: string }) {
  return <Skeleton className={cn('rounded-2xl', className)} />
}
