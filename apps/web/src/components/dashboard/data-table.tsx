'use client'

import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table'
import { ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Search } from 'lucide-react'
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  cn,
} from '@strimz/ui'

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** When provided, shows a search box that filters across all columns. */
  searchPlaceholder?: string
  /** Optional toolbar slot (filter chips, action buttons). */
  toolbar?: React.ReactNode
  /** Empty-state copy when the source list is empty. */
  emptyTitle?: string
  emptyDescription?: string
  /** Page size for client pagination. */
  pageSize?: number
  /**
   * When true, renders skeleton rows in place of the empty-state. Used
   * by data-fetching pages to bridge the first-load gap without
   * flashing "No results" before the query resolves.
   */
  loading?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder,
  toolbar,
  emptyTitle = 'No results',
  emptyDescription = 'Nothing here yet. Adjust your filters or check back later.',
  pageSize = 10,
  loading = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {searchPlaceholder ? (
          <div className="relative w-full sm:max-w-xs">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 pl-8"
            />
          </div>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Columns3 className="size-4" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {table
                .getAllColumns()
                .filter((c) => c.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(Boolean(v))}
                    className="capitalize"
                  >
                    {column.id.replace(/_/g, ' ')}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="shadow-sub-card border-border/60 bg-background overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-muted-foreground h-11 text-xs font-medium uppercase tracking-wide"
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="size-3 opacity-60" />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && table.getRowModel().rows.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((_, j) => (
                    <TableCell key={j} className="py-3">
                      <div className="bg-muted/60 h-4 w-3/4 animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40">
                  <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center">
                    <div className="text-sm font-medium">{emptyTitle}</div>
                    <div className="text-muted-foreground text-xs">{emptyDescription}</div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="text-muted-foreground text-xs">
          {table.getFilteredRowModel().rows.length}{' '}
          {table.getFilteredRowModel().rows.length === 1 ? 'row' : 'rows'}
          {globalFilter ? ` matching "${globalFilter}"` : ''}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground text-xs">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function StatusPill({
  tone,
  children,
}: {
  tone: 'positive' | 'warning' | 'danger' | 'info' | 'neutral'
  children: React.ReactNode
}) {
  const tones: Record<typeof tone, string> = {
    positive: 'bg-[#02C76A]/10 text-[#02C76A] border-[#02C76A]/20',
    warning: 'bg-amber-500/10  text-amber-600  border-amber-500/20',
    danger: 'bg-rose-500/10   text-rose-600   border-rose-500/20',
    info: 'bg-sky-500/10    text-sky-600    border-sky-500/20',
    neutral: 'bg-muted/60      text-muted-foreground border-border/60',
  }
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}
