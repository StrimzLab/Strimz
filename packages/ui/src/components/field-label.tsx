'use client'

import * as React from 'react'
import { Label } from './label'
import { cn } from '../lib/cn'

export function FieldLabel({
  htmlFor,
  required,
  children,
  className,
}: {
  htmlFor?: string
  required: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <Label htmlFor={htmlFor} className={cn('flex items-center gap-1.5', className)}>
      <span>{children}</span>
      {required ? (
        <>
          <span className="text-muted-foreground text-xs font-normal">(required)</span>
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
        </>
      ) : (
        <span className="text-muted-foreground text-xs font-normal">(optional)</span>
      )}
    </Label>
  )
}
