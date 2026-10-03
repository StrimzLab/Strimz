'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  buttonVariants,
} from '@strimz/ui'

import type { ConfirmCopy } from '@/lib/destructive-actions'

export interface PendingConfirm {
  copy: ConfirmCopy
  run: () => void
}

export function ConfirmActionDialog({
  pending,
  onClose,
}: {
  pending: PendingConfirm | null
  onClose: () => void
}) {
  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <AlertDialogContent className="bg-background border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">{pending?.copy.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {pending?.copy.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Go back</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
            onClick={() => pending?.run()}
          >
            {pending?.copy.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
