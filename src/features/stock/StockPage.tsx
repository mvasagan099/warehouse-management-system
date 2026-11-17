import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { ArrowRightLeft, QrCode, Scale } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canDecide, canOperate } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Field, Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatDateTime, formatNumber } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { StockItem } from '../../lib/types'
import { useClients, useSetting, useWarehouses } from '../shared/queries'
import { expiringSoon, expiryState, groupBySlot, todayIST } from './stock'

type Tab = 'stock' | 'slots' | 'expiry' | 'ledger'

function ExpiryBadge({ date, days }: { date: string | null; days: number }) {
  const { t, i18n } = useTranslation()
  const st = expiryState(date, days, todayIST())
  if (!date) return <>—</>
  return <Badge tone={st === 'expired' ? 'red' : st === 'soon' ? 'amber' : 'gray'}>{formatDate(date, i18n.resolvedLanguage)}{st === 'expired' ? ` · ${t('stock.expired')}` : ''}</Badge>
}

function TransferDialog({ item, onClose, onDone }: { item: StockItem; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const [qty, setQty] = useState(String(item.quantity))
  const [slot, setSlot] = useState('')
  const [reason, setReason] = useState('')
  const slots = useQuery({
    queryKey: ['slot_options', item.warehouse_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('brigade_slots').select('id, code, status').eq('warehouse_id', item.warehouse_id)
        .is('deleted_at', null).in('status', ['FREE', 'RESERVED', 'OCCUPIED']).order('code').limit(2000)
      if (error) throw error
      return data
    },
  })
  const move = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc('transfer_stock', { p_stock_item_id: item.id, p_to_slot_id: slot, p_quantity: Number(qty), p_reason: reason || undefined }); if (error) throw error },
    onSuccess: () => { toast.success(t('stock.transferred')); onDone() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={`${t('stock.transfer')} — ${item.item_name}`} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button loading={move.isPending} disabled={!slot || !(Number(qty) > 0)} onClick={() => move.mutate()}>{t('stock.transfer')}</Button>
      </>
    }>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{t('stock.from')}: <span className="font-mono">{item.slot_code}</span> · {formatNumber(item.quantity, undefined, 3)} {item.unit}</p>
        <Field label={t('stock.toSlot')} htmlFor="tr-slot">
          <Select id="tr-slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
            <option value="">{t('common.select')}</option>
            {slots.data?.filter((s) => s.id !== item.slot_id).map((s) => <option key={s.id} value={s.id}>{s.code} · {t(`slotStatus.${s.status}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('common.quantity')} htmlFor="tr-qty"><Input id="tr-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label={t('common.reason')} htmlFor="tr-reason" optional><Input id="tr-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function AdjustDialog({ item, newQty, onNewQty, loading, onConfirm, onClose }: {
  item: StockItem; newQty: string; onNewQty: (v: string) => void; loading: boolean; onConfirm: (reason: string) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const qtyOk = newQty !== '' && Number(newQty) >= 0 && Number.isFinite(Number(newQty))
  return (
    <Modal open title={`${t('stock.adjust')} — ${item.item_name}`} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button loading={loading} onClick={() => { setTouched(true); if (reason.trim() && qtyOk) onConfirm(reason.trim()) }}>{t('stock.adjust')}</Button>
      </>
    }>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{t('stock.adjustHelp', { qty: item.quantity })}</p>
        <Field label={t('stock.newQuantity')} htmlFor="adj-qty" error={touched && !qtyOk ? 'validation.number' : undefined}>
          <Input id="adj-qty" inputMode="decimal" value={newQty} onChange={(e) => onNewQty(e.target.value)} />
        </Field>
        <Field label={t('common.reasonRequired')} htmlFor="adj-reason" error={touched && !reason.trim() ? 'validation.required' : undefined}>
          <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

export function StockPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const isClient = profile?.role === 'CLIENT'
  const operate = canOperate(profile?.role)
  const decide = canDecide(profile?.role)
  const qc = useQueryClient()
  const clients = useClients()
  const warehouses = useWarehouses()
  const defaultDays = useSetting<number>('expiry_alert_days', 30)
  const [tab, setTab] = useState<Tab>('stock')
  const [search, setSearch] = useState('')
  const [clientId, setClientId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [days, setDays] = useState<string>('')
  const [transfer, setTransfer] = useState<StockItem | null>(null)
  const [adjust, setAdjust] = useState<StockItem | null>(null)
  const [newQty, setNewQty] = useState('')

  const windowDays = Number(days || defaultDays.data || 30)

  const stock = useQuery({
    queryKey: ['stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_items').select('*').is('deleted_at', null).gt('quantity', 0).order('expiry_date', { ascending: true, nullsFirst: false }).limit(3000)
      if (error) throw error
      return data
    },
  })
  const ledger = useQuery({
    queryKey: ['stock_ledger'],
    enabled: tab === 'ledger',
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_movements').select('*, stock_items(item_name, batch_no, slot_code)').order('created_at', { ascending: false }).limit(300)
      if (error) throw error
      return data
    },
  })

  const refresh = () => { for (const k of ['stock', 'stock_ledger', 'v_zone_slot_summary']) void qc.invalidateQueries({ queryKey: [k] }) }
  const doAdjust = useMutation({
    mutationFn: async (reason: string) => { const { error } = await supabase.rpc('adjust_stock', { p_stock_item_id: adjust!.id, p_new_quantity: Number(newQty), p_reason: reason }); if (error) throw error },
    onSuccess: () => { toast.success(t('stock.adjusted')); setAdjust(null); refresh() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.company_name])), [clients.data])
  const whName = useMemo(() => new Map((warehouses.data ?? []).map((w) => [w.id, w.code])), [warehouses.data])
  const rows = useMemo(() => (stock.data ?? []).filter((i) => (!clientId || i.client_id === clientId) && (!warehouseId || i.warehouse_id === warehouseId)), [stock.data, clientId, warehouseId])
  const expiring = useMemo(() => expiringSoon(rows, windowDays, todayIST()), [rows, windowDays])
  const slotGroups = useMemo(() => groupBySlot(rows), [rows])

  const columns = useMemo<ColumnDef<StockItem>[]>(() => [
    ...(!isClient ? [{ id: 'client', header: t('common.client'), accessorFn: (i: StockItem) => clientName.get(i.client_id) ?? '' } satisfies ColumnDef<StockItem>] : []),
    { id: 'wh', header: t('common.warehouse'), accessorFn: (i) => whName.get(i.warehouse_id) ?? '' },
    { accessorKey: 'item_name', header: t('common.item'), cell: (c) => <span className="font-medium">{c.getValue<string>()}{c.row.original.sku && <span className="block font-mono text-xs text-slate-500">{c.row.original.sku}</span>}</span> },
    { accessorKey: 'batch_no', header: t('common.batch'), cell: (c) => c.getValue<string | null>() ?? '—' },
    { accessorKey: 'expiry_date', header: t('common.expiry'), cell: (c) => <ExpiryBadge date={c.getValue<string | null>()} days={windowDays} /> },
    { accessorKey: 'quantity', header: t('common.quantity'), cell: (c) => `${formatNumber(c.getValue<number>(), lang, 3)} ${c.row.original.unit}` },
    { accessorKey: 'weight_kg', header: t('gate.weightKg'), cell: (c) => formatNumber(c.getValue<number>(), lang) },
    { accessorKey: 'slot_code', header: t('common.slot'), cell: (c) => <span className="font-mono text-xs">{c.getValue<string>()}</span> },
    { accessorKey: 'condition', header: t('common.status'), cell: (c) => <Badge tone={c.getValue() === 'GOOD' ? 'green' : 'red'}>{t(`stockCondition.${c.getValue<string>()}`)}</Badge> },
    ...(operate ? [{
      id: 'actions', header: t('common.actions'),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => setTransfer(row.original)}>{t('stock.transfer')}</Button>
          {decide && <Button size="sm" variant="ghost" icon={<Scale className="h-4 w-4" />} onClick={() => { setAdjust(row.original); setNewQty(String(row.original.quantity)) }}>{t('stock.adjust')}</Button>}
          <Link to={`/labels?stock=${row.original.id}`} aria-label={t('labels.title')} className="inline-flex items-center rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"><QrCode className="h-4 w-4" /></Link>
        </div>
      ),
    } satisfies ColumnDef<StockItem>] : []),
  ], [t, lang, isClient, operate, decide, clientName, whName, windowDays])

  const tabs: [Tab, string][] = [['stock', t('stock.tabStock')], ['slots', t('stock.tabSlots')], ['expiry', t('stock.tabExpiry')], ...(operate ? [['ledger', t('stock.tabLedger')] as [Tab, string]] : [])]

  return (
    <div>
      <PageHeader title={t('stock.title')} subtitle={isClient ? t('stock.clientHelp') : undefined} />
      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={clsx('-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium', tab === k ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>
            {label}{k === 'expiry' && expiring.length > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800">{expiring.length}</span>}
          </button>
        ))}
      </div>
      <Card>
        <Toolbar>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" aria-label={t('common.search')} />
          {!isClient && (
            <Select aria-label={t('common.client')} value={clientId} onChange={(e) => setClientId(e.target.value)} className="sm:w-56">
              <option value="">{t('stock.allClients')}</option>
              {clients.data?.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </Select>
          )}
          {(warehouses.data?.length ?? 0) > 1 && (
            <Select aria-label={t('common.warehouse')} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="sm:w-48">
              <option value="">{t('dashboard.allWarehouses')}</option>
              {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
            </Select>
          )}
          {tab === 'expiry' && (
            <label className="flex items-center gap-2 text-sm">
              {t('stock.withinDays')}
              <Input type="number" min={0} value={days || String(defaultDays.data ?? 30)} onChange={(e) => setDays(e.target.value)} className="w-24" aria-label={t('stock.withinDays')} />
            </label>
          )}
        </Toolbar>

        {tab === 'stock' && (
          <DataTable data={rows} columns={columns} loading={stock.isPending || clients.isPending} error={stock.error ? t('common.error') : null}
            onRetry={() => stock.refetch()} search={search} filtered={!!clientId || !!warehouseId} emptyMessage={t('stock.empty')} />
        )}
        {tab === 'expiry' && (
          <DataTable data={expiring} columns={columns} loading={stock.isPending} error={stock.error ? t('common.error') : null} search={search} emptyMessage={t('stock.noExpiring', { days: windowDays })} />
        )}
        {tab === 'slots' && (
          <div className="divide-y divide-slate-100">
            {slotGroups.length === 0 && <p className="p-8 text-center text-sm text-slate-500">{t('stock.empty')}</p>}
            {slotGroups
              .filter((g) => !search || g.slot.toLowerCase().includes(search.toLowerCase()) || g.items.some((i) => i.item_name.toLowerCase().includes(search.toLowerCase())))
              .map((g) => (
                <div key={g.slot} className="flex flex-wrap items-start gap-4 p-4">
                  <div className="w-52 font-mono text-sm font-semibold">{g.slot}</div>
                  <ul className="flex-1 space-y-1 text-sm">
                    {g.items.map((i) => (
                      <li key={i.id} className="flex flex-wrap justify-between gap-2">
                        <span>{i.item_name} <span className="text-slate-500">{i.batch_no}</span>{!isClient && <span className="text-slate-400"> · {clientName.get(i.client_id)}</span>}</span>
                        <span className="font-medium">{formatNumber(i.quantity, lang, 3)} {i.unit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
        {tab === 'ledger' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">{t('common.date')}</th><th className="px-4 py-2">{t('stock.movement')}</th><th className="px-4 py-2">{t('common.item')}</th><th className="px-4 py-2">{t('common.quantity')}</th><th className="px-4 py-2">{t('common.slot')}</th><th className="px-4 py-2">{t('common.reason')}</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(ledger.data ?? []).map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(m.created_at, lang)}</td>
                    <td className="px-4 py-2"><Badge tone={m.movement_type === 'IN' ? 'green' : m.movement_type === 'OUT' ? 'violet' : 'blue'}>{t(`movementType.${m.movement_type}`)}</Badge></td>
                    <td className="px-4 py-2">{(m.stock_items as { item_name?: string } | null)?.item_name} <span className="text-slate-500">{(m.stock_items as { batch_no?: string } | null)?.batch_no}</span></td>
                    <td className={clsx('px-4 py-2 font-medium', m.qty_delta < 0 ? 'text-red-700' : 'text-emerald-700')}>{m.qty_delta > 0 ? '+' : ''}{formatNumber(m.qty_delta, lang, 3)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{(m.stock_items as { slot_code?: string } | null)?.slot_code}</td>
                    <td className="px-4 py-2 text-slate-600">{m.reason ?? '—'}</td>
                  </tr>
                ))}
                {ledger.data?.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">{t('common.noData')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {transfer && <TransferDialog item={transfer} onClose={() => setTransfer(null)} onDone={() => { setTransfer(null); refresh() }} />}
      {adjust && (
        <AdjustDialog
          item={adjust}
          newQty={newQty}
          onNewQty={setNewQty}
          loading={doAdjust.isPending}
          onConfirm={(r) => doAdjust.mutate(r)}
          onClose={() => setAdjust(null)}
        />
      )}
    </div>
  )
}
