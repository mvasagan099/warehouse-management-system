import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { ErrorState, EmptyState } from './misc'
import { Spinner } from './Spinner'

export interface ServerPagination {
  pagination: PaginationState
  onPaginationChange: (p: PaginationState) => void
  rowCount: number
}

export interface DataTableProps<T> {
  data: T[] | undefined
  columns: ColumnDef<T, any>[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** client-side text search across all columns */
  search?: string
  /** when given, pagination happens on the server */
  server?: ServerPagination
  pageSize?: number
  emptyMessage?: string
  filtered?: boolean
}

export function DataTable<T>({
  data,
  columns,
  loading,
  error,
  onRetry,
  search,
  server,
  pageSize = 20,
  emptyMessage,
  filtered,
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const [sorting, setSorting] = useState<SortingState>([])
  const [localPagination, setLocalPagination] = useState<PaginationState>({ pageIndex: 0, pageSize })

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: {
      sorting,
      globalFilter: server ? undefined : search,
      pagination: server ? server.pagination : localPagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const current = server ? server.pagination : localPagination
      const next = typeof updater === 'function' ? updater(current) : updater
      if (server) server.onPaginationChange(next)
      else setLocalPagination(next)
    },
    manualPagination: !!server,
    rowCount: server?.rowCount,
    autoResetPageIndex: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: server ? undefined : getPaginationRowModel(),
  })

  if (error) return <div className="p-4"><ErrorState message={error} onRetry={onRetry} retryLabel={t('common.retry')} /></div>

  const rows = table.getRowModel().rows
  const totalRows = server ? server.rowCount : table.getFilteredRowModel().rows.length
  const pageCount = Math.max(1, table.getPageCount())

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sortable = h.column.getCanSort() && !server
                  const dir = h.column.getIsSorted()
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className="whitespace-nowrap px-4 py-2.5 text-left text-[13px] font-semibold text-slate-600"
                    >
                      {h.isPlaceholder ? null : sortable ? (
                        <button className="inline-flex items-center gap-1 uppercase" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : null}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-slate-500">
                  <span className="inline-flex items-center gap-2"><Spinner /> {t('common.loading')}</span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState message={search || filtered ? t('common.noResults') : (emptyMessage ?? t('common.noData'))} />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-brand-50/50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-2.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && totalRows > 0 && (
        <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row">
          <span>{t('common.rowsTotal', { count: totalRows })}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} icon={<ChevronLeft className="h-4 w-4" />}>
              {t('common.previous')}
            </Button>
            <span>{t('common.pageOf', { page: table.getState().pagination.pageIndex + 1, count: pageCount })}</span>
            <Button size="sm" variant="secondary" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              {t('common.next')} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
