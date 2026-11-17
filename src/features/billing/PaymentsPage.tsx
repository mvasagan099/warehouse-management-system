import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canWrite } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Input } from '../../components/ui/Field'
import { ReasonDialog } from '../../components/ui/ReasonDialog'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import type { Payment } from '../../lib/types'
import { useClients } from '../shared/queries'
import { PaymentDialog, refreshBilling } from './InvoiceDialogs'

export function PaymentsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const qc = useQueryClient()
  const { profile } = useAuth()
  const admin = canWrite(profile?.role, 'payments')
  const isClient = profile?.role === 'CLIENT'
  const clients = useClients()
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [reversing, setReversing] = useState<Payment | null>(null)
  const list = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payments').select('*').order('paid_on', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
      if (error) throw error
      return data
    },
  })
  const name = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.company_name])), [clients.data])
  const reverse = useMutation({
    mutationFn: async (reason: string) => { const { error } = await supabase.rpc('reverse_payment', { p_payment_id: reversing!.id, p_reason: reason }); if (error) throw error },
    onSuccess: () => { toast.success(t('billing.paymentReversed')); setReversing(null); refreshBilling(qc) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  const columns = useMemo<ColumnDef<Payment>[]>(() => [
    { accessorKey: 'payment_no', header: t('billing.paymentNo'), cell: (c) => <span className="font-mono text-xs">{c.getValue<string>()}</span> },
    { accessorKey: 'paid_on', header: t('common.date'), cell: (c) => formatDate(c.getValue<string>(), lang) },
    ...(!isClient ? [{ id: 'client', header: t('common.client'), accessorFn: (r: Payment) => name.get(r.client_id) ?? '' } satisfies ColumnDef<Payment>] : []),
    { accessorKey: 'method', header: t('billing.method'), cell: (c) => t(`paymentMethod.${c.getValue<string>()}`) },
    { accessorKey: 'reference', header: t('billing.reference'), cell: (c) => c.getValue<string | null>() ?? '—' },
    { accessorKey: 'amount_paise', header: t('billing.amount'), cell: (c) => <span className="block text-right">{formatINR(c.getValue<number>())}</span> },
    { accessorKey: 'status', header: t('common.status'), cell: (c) => <Badge tone={c.getValue() === 'RECORDED' ? 'green' : 'red'}>{t(`billing.payment${c.getValue<string>()}`)}</Badge> },
    ...(admin ? [{ id: 'act', header: '', cell: ({ row }) => row.original.status === 'RECORDED' ? <Button size="sm" variant="ghost" icon={<Undo2 className="h-4 w-4" />} onClick={() => setReversing(row.original)}>{t('billing.reverse')}</Button> : null } satisfies ColumnDef<Payment>] : []),
  ], [t, lang, isClient, admin, name])
  return (
    <div>
      <PageHeader title={t('billing.payments')} actions={admin && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>{t('billing.recordPayment')}</Button>} />
      <Card>
        <Toolbar><Input placeholder={t('common.search')} aria-label={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" /></Toolbar>
        <DataTable data={list.data} columns={columns} loading={list.isPending} error={list.error ? t('common.error') : null} onRetry={() => list.refetch()} search={search} emptyMessage={t('billing.noPayments')} />
      </Card>
      {adding && <PaymentDialog onClose={() => setAdding(false)} />}
      <ReasonDialog open={!!reversing} title={t('billing.reverse')} message={t('billing.reverseHelp')} loading={reverse.isPending} onConfirm={(r) => reverse.mutate(r)} onClose={() => setReversing(null)} />
    </div>
  )
}
