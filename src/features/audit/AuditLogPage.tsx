import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { formatDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Constants, type AuditLog } from '../../lib/types'
import { changedFields, displayValue } from './diff'

const AUDITED_TABLES = [
  'warehouses', 'zones', 'brigade_types', 'brigade_slots', 'profiles', 'warehouse_managers', 'vacancies', 'applicants',
  'clients', 'contracts', 'company_master', 'space_bookings', 'gate_entries', 'gate_entry_lines', 'inward_receipts',
  'inward_receipt_lines', 'stock_items', 'slot_allocations', 'labour_entries', 'dispatch_requests',
  'dispatch_request_lines', 'dispatch_picks', 'delivery_challans', 'delivery_challan_lines',
  'invoices', 'payments', 'adjustment_notes', 'rate_cards', 'rent_rates', 'labour_rates', 'tax_rules',
  'sensors', 'device_keys', 'calibration_log', 'alert_rules', 'defrost_windows', 'alerts', 'equipment', 'maintenance_tasks', 'client_notices',
  'employees', 'employee_private', 'vacancy_salaries', 'interview_rounds', 'shifts', 'attendance', 'crew_log',
  'client_contacts', 'support_tickets', 'client_change_requests', 'opening_balances',
]
const ACTION_TONE = { INSERT: 'green', UPDATE: 'blue', DELETE: 'red' } as const

export function AuditLogPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 })
  const [table, setTable] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [who, setWho] = useState('')
  const [viewing, setViewing] = useState<AuditLog | null>(null)
  useEffect(() => setPagination((p) => ({ ...p, pageIndex: 0 })), [table, action, from, to, who])

  const people = useQuery({ queryKey: ['audit_people'], queryFn: async () => { const { data, error } = await supabase.from('profiles').select('id, full_name, email').in('role', ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF', 'ACCOUNTANT']).order('full_name'); if (error) throw error; return data } })
  const logs = useQuery({
    queryKey: ['audit', table, action, from, to, who, pagination.pageIndex, pagination.pageSize],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = pagination.pageIndex * pagination.pageSize
      let q = supabase.from('audit_logs').select('*', { count: 'exact' }).order('changed_at', { ascending: false }).range(from, from + pagination.pageSize - 1)
      if (table) q = q.eq('table_name', table)
      if (action) q = q.eq('action', action as AuditLog['action'])
      if (from) q = q.gte('changed_at', `${from}T00:00:00+05:30`)
      if (to) q = q.lte('changed_at', `${to}T23:59:59.999+05:30`)
      if (who) q = q.eq('changed_by', who)
      const { data, error, count } = await q
      if (error) throw error
      // resolve user names for this page (admins can read all profiles)
      const ids = [...new Set(data.map((d) => d.changed_by).filter((x): x is string => !!x))]
      const names = new Map<string, string>()
      if (ids.length) {
        const { data: people } = await supabase.from('profiles').select('id, full_name, email').in('id', ids)
        people?.forEach((p) => names.set(p.id, p.full_name || p.email))
      }
      return { rows: data, count: count ?? 0, names }
    },
  })

  const columns = useMemo<ColumnDef<AuditLog>[]>(() => [
    { accessorKey: 'changed_at', header: t('audit.changedAt'), cell: (c) => formatDateTime(c.getValue<string>(), lang) },
    { accessorKey: 'table_name', header: t('audit.table'), cell: (c) => <span className="font-mono text-xs">{c.getValue<string>()}</span> },
    { accessorKey: 'action', header: t('audit.action'), cell: (c) => <Badge tone={ACTION_TONE[c.getValue<AuditLog['action']>()]}>{t(`auditAction.${c.getValue<string>()}`)}</Badge> },
    {
      id: 'summary',
      header: t('audit.changes'),
      cell: ({ row }) => {
        const r = row.original
        const rec = (r.new_data ?? r.old_data) as Record<string, unknown> | null
        const label = (rec?.code ?? rec?.name ?? rec?.full_name ?? rec?.title ?? r.record_id?.slice(0, 8)) as string
        const fields = r.action === 'UPDATE' ? changedFields(r.old_data, r.new_data).map((f) => f.field).join(', ') : ''
        return <span className="text-slate-600"><strong className="font-medium text-slate-800">{label}</strong>{fields && ` — ${fields}`}</span>
      },
    },
    { accessorKey: 'changed_by', header: t('audit.changedBy'), cell: (c) => { const id = c.getValue<string | null>(); return id ? (logs.data?.names.get(id) ?? id.slice(0, 8)) : t('audit.system') } },
    { id: 'view', header: '', cell: ({ row }) => <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => setViewing(row.original)}>{t('common.details')}</Button> },
  ], [t, lang, logs.data])

  const changes = viewing ? (viewing.action === 'UPDATE' ? changedFields(viewing.old_data, viewing.new_data) : changedFields(viewing.action === 'INSERT' ? null : viewing.old_data, viewing.action === 'INSERT' ? viewing.new_data : null)) : []

  return (
    <div>
      <PageHeader title={t('audit.title')} />
      <Card>
        <Toolbar>
          <Select aria-label={t('audit.table')} value={table} onChange={(e) => setTable(e.target.value)} className="sm:w-56">
            <option value="">{t('audit.allTables')}</option>
            {AUDITED_TABLES.map((tb) => <option key={tb} value={tb}>{tb}</option>)}
          </Select>
          <Select aria-label={t('audit.action')} value={action} onChange={(e) => setAction(e.target.value)} className="sm:w-44">
            <option value="">{t('audit.allActions')}</option>
            {Constants.public.Enums.audit_action.map((a) => <option key={a} value={a}>{t(`auditAction.${a}`)}</option>)}
          </Select>
          <Input type="date" aria-label={t('billing.periodFrom')} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="sm:w-40" />
          <Input type="date" aria-label={t('billing.periodTo')} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="sm:w-40" />
          <Select aria-label={t('audit.changedBy')} value={who} onChange={(e) => setWho(e.target.value)} className="sm:w-48">
            <option value="">{t('audit.anyone')}</option>
            {(people.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </Select>
        </Toolbar>
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{t('audit.maskedNote')}</p>
        <DataTable
          data={logs.data?.rows}
          columns={columns}
          loading={logs.isPending}
          error={logs.error ? t('common.error') : null}
          onRetry={() => logs.refetch()}
          filtered={!!table || !!action || !!from || !!to || !!who}
          server={{ pagination, onPaginationChange: setPagination, rowCount: logs.data?.count ?? 0 }}
        />
      </Card>
      {viewing && (
        <Modal open size="lg" title={`${viewing.table_name} · ${t(`auditAction.${viewing.action}`)}`} onClose={() => setViewing(null)}>
          <p className="mb-3 text-sm text-slate-500">{formatDateTime(viewing.changed_at, lang)} · {t('audit.record')}: <span className="font-mono">{viewing.record_id}</span></p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="py-1 pr-4">Field</th><th className="py-1 pr-4">{t('audit.oldData')}</th><th className="py-1">{t('audit.newData')}</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {changes.map((c) => (
                  <tr key={c.field} className="align-top">
                    <td className="py-1.5 pr-4 font-mono text-xs">{c.field}</td>
                    <td className="max-w-xs break-all py-1.5 pr-4 text-red-700">{displayValue(c.before)}</td>
                    <td className="max-w-xs break-all py-1.5 text-emerald-700">{displayValue(c.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  )
}
