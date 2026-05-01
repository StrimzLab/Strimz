import type { ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@strimz/ui'
import { EmptyState } from './empty-state'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  align?: 'left' | 'right'
}

export function ResourceList<T extends { id: string }>({
  rows,
  columns,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
}: {
  rows: T[]
  columns: Column<T>[]
  emptyTitle: string
  emptyDescription?: string
  emptyIcon: React.ComponentType<{ className?: string }>
  emptyAction?: ReactNode
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }
  return (
    <div className="strimz-card-shadow overflow-hidden rounded-xl border border-border/60 bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={c.align === 'right' ? 'text-right' : undefined}
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="transition-colors hover:bg-muted/30">
              {columns.map((c) => (
                <TableCell
                  key={c.key}
                  className={c.align === 'right' ? 'text-right' : undefined}
                >
                  {c.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
