import { Badge, cn } from '@strimz/ui'

export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('border-border/60 text-muted-foreground text-[10px] font-normal', className)}
    >
      Coming soon
    </Badge>
  )
}
