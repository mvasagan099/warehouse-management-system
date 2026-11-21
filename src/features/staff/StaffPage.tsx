import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, LockKeyhole, Pencil, Upload, UserMinus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, EmptyState, ErrorState, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { openPrivateFile, safeFileName } from '../../lib/download'
import { errorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Constants, type Employee, type EmployeeStatus, type JobRole } from '../../lib/types'
import { useWarehouses } from '../shared/queries'

const TONE: Record<EmployeeStatus, 'green' | 'amber' | 'gray'> = { ACTIVE: 'green', ON_LEAVE: 'amber', EXITED: 'gray' }
export const maskAccount = (n: string | null | undefined) => (n ? `${'•'.repeat(Math.max(n.length - 4, 0))}${n.slice(-4)}` : '—')

function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*').is('deleted_at', null).order('code')
      if (error) throw error
      const ids = data.map((e) => e.user_id)
      const { data: people, error: pe } = ids.length ? await supabase.from('profiles').select('id, full_name, email, phone, role').in('id', ids) : { data: [], error: null }
      if (pe) throw pe
      const byId = new Map((people ?? []).map((p) => [p.id, p]))
      return data.map((e) => ({ ...e, person: byId.get(e.user_id) }))
    },
  })
}
type Row = Employee & { person?: { id: string; full_name: string; email: string; phone: string | null; role: string } }

/** Administrator only: ID proof and bank details. They live in their own table, are never listed, and the audit log keeps only "***". */
function PrivateDialog({ employee, onClose }: { employee: Row; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [reveal, setReveal] = useState(false)
  const priv = useQuery({
    queryKey: ['employee_private', employee.id],
    queryFn: async () => { const { data, error } = await supabase.from('employee_private').select('*').eq('employee_id', employee.id).maybeSingle(); if (error) throw error; return data },
  })
  const [f, setF] = useState<{ holder: string; bank: string; no: string; ifsc: string; idType: string } | null>(null)
  const cur = f ?? { holder: priv.data?.bank_account_holder ?? '', bank: priv.data?.bank_name ?? '', no: priv.data?.bank_account_no ?? '', ifsc: priv.data?.bank_ifsc ?? '', idType: priv.data?.id_proof_type ?? 'AADHAAR' }
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('employee_private').upsert({ employee_id: employee.id, warehouse_id: employee.warehouse_id, bank_account_holder: cur.holder.trim() || null, bank_name: cur.bank.trim() || null,
        bank_account_no: cur.no.trim() || null, bank_ifsc: cur.ifsc.trim().toUpperCase() || null, id_proof_type: cur.idType, id_proof_path: priv.data?.id_proof_path ?? null } as never)
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('common.saved')); void qc.invalidateQueries({ queryKey: ['employee_private', employee.id] }); setF(null) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const upload = async (file: File) => {
    try {
      const path = `idproof/${employee.id}/${Date.now()}-${safeFileName(file.name)}`
      const up = await supabase.storage.from('hr').upload(path, file, { contentType: file.type }); if (up.error) throw up.error
      const { error } = await supabase.from('employee_private').upsert({ employee_id: employee.id, warehouse_id: employee.warehouse_id, id_proof_type: cur.idType, id_proof_path: path } as never); if (error) throw error
      toast.success(t('staff.idSaved')); void priv.refetch()
    } catch (e) { toast.error(await errorMessage(e)) }
  }
  return (
    <Modal open title={`${t('staff.privateDetails')} · ${employee.person?.full_name ?? employee.code}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.close')}</Button><Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800"><LockKeyhole className="h-4 w-4 shrink-0" />{t('staff.sensitiveNote')}</p>
      {priv.isPending ? <Spinner /> : (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label={t('staff.idType')} htmlFor="pv-idt"><Select id="pv-idt" value={cur.idType} onChange={(e) => setF({ ...cur, idType: e.target.value })}>{['AADHAAR', 'PAN', 'VOTER_ID', 'DRIVING_LICENCE', 'PASSPORT'].map((x) => <option key={x} value={x}>{t(`staff.idTypes.${x}`)}</option>)}</Select></Field>
          <div className="flex items-end gap-2">
            {priv.data?.id_proof_path && <Button size="sm" variant="secondary" onClick={() => openPrivateFile('hr', priv.data!.id_proof_path!).catch(async (e) => toast.error(await errorMessage(e)))}>{t('staff.openId')}</Button>}
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"><Upload className="h-4 w-4" />{t('staff.uploadId')}
              <input type="file" accept="application/pdf,image/*" className="sr-only" aria-label={t('staff.uploadId')} onChange={(e) => { const x = e.target.files?.[0]; if (x) void upload(x) }} /></label>
          </div>
          <Field label={t('staff.accountHolder')} htmlFor="pv-holder" optional><Input id="pv-holder" autoComplete="off" value={cur.holder} onChange={(e) => setF({ ...cur, holder: e.target.value })} /></Field>
          <Field label={t('staff.bankName')} htmlFor="pv-bank" optional><Input id="pv-bank" autoComplete="off" value={cur.bank} onChange={(e) => setF({ ...cur, bank: e.target.value })} /></Field>
          <Field label={t('staff.accountNo')} htmlFor="pv-no" optional hint={reveal ? undefined : maskAccount(priv.data?.bank_account_no)}>
            <div className="flex gap-1"><Input id="pv-no" autoComplete="off" type={reveal ? 'text' : 'password'} inputMode="numeric" value={cur.no} onChange={(e) => setF({ ...cur, no: e.target.value })} />
              <Button size="sm" variant="ghost" aria-label={reveal ? t('staff.hide') : t('staff.show')} onClick={() => setReveal(!reveal)} icon={reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} /></div></Field>
          <Field label={t('staff.ifsc')} htmlFor="pv-ifsc" optional><Input id="pv-ifsc" autoComplete="off" value={cur.ifsc} onChange={(e) => setF({ ...cur, ifsc: e.target.value.toUpperCase() })} placeholder="HDFC0001234" /></Field>
        </div>)}
    </Modal>
  )
}

function EditDialog({ employee, onClose }: { employee: Row; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [f, setF] = useState({ job_role: employee.job_role, status: employee.status, name: employee.emergency_contact_name ?? '', phone: employee.emergency_contact_phone ?? '', joining: employee.joining_date })
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'SUPER_ADMIN'
  const loginRole = employee.person?.role
  const save = useMutation({
    mutationFn: async () => {
      // Making someone a manager (or back to staff) changes their LOGIN role and warehouse assignment, not just a label.
      const wantsManager = f.job_role === 'MANAGER'
      if (isAdmin && (loginRole === 'STAFF' || loginRole === 'WAREHOUSE_MANAGER') && wantsManager !== (loginRole === 'WAREHOUSE_MANAGER')) {
        const { error } = await (supabase.rpc as unknown as (fn: string, args: object) => Promise<{ error: { message: string } | null }>)('change_login_role', { p_user_id: employee.user_id, p_new_role: wantsManager ? 'WAREHOUSE_MANAGER' : 'STAFF' })
        if (error) throw error
      }
      const { error } = await supabase.from('employees').update({ job_role: f.job_role, status: f.status === 'EXITED' ? employee.status : f.status, emergency_contact_name: f.name.trim() || null, emergency_contact_phone: f.phone.trim() || null, joining_date: f.joining }).eq('id', employee.id)
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('common.saved')); void qc.invalidateQueries({ queryKey: ['employees'] }); void qc.invalidateQueries({ queryKey: ['users'] }); onClose() }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={`${t('common.edit')} · ${employee.person?.full_name ?? employee.code}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <Field label={t('hiring.jobRole')} htmlFor="em-role"><Select id="em-role" value={f.job_role} onChange={(e) => setF({ ...f, job_role: e.target.value as JobRole })}>{Constants.public.Enums.job_role.filter((r) => isAdmin || r !== 'MANAGER').map((r) => <option key={r} value={r}>{t(`jobRole.${r}`)}</option>)}</Select>{f.job_role === 'MANAGER' && loginRole === 'STAFF' && <p className="mt-1 text-xs text-amber-700">{t('staff.promoteNote')}</p>}</Field>
        <Field label={t('common.status')} htmlFor="em-status"><Select id="em-status" value={f.status} disabled={employee.status === 'EXITED'} onChange={(e) => setF({ ...f, status: e.target.value as EmployeeStatus })}>{(['ACTIVE', 'ON_LEAVE'] as const).map((x) => <option key={x} value={x}>{t(`employeeStatus.${x}`)}</option>)}</Select></Field>
        <Field label={t('staff.joiningDate')} htmlFor="em-join"><Input id="em-join" type="date" value={f.joining} onChange={(e) => setF({ ...f, joining: e.target.value })} /></Field>
        <div />
        <Field label={t('staff.emergencyName')} htmlFor="em-en" optional><Input id="em-en" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label={t('staff.emergencyPhone')} htmlFor="em-ep" optional><Input id="em-ep" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

export function StaffPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const qc = useQueryClient()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'SUPER_ADMIN'
  const list = useEmployees()
  const whs = useWarehouses()
  const [edit, setEdit] = useState<Row | null>(null)
  const [priv, setPriv] = useState<Row | null>(null)
  const [leaving, setLeaving] = useState<Row | null>(null)
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10))
  const [q, setQ] = useState('')
  const [showExited, setShowExited] = useState(false)
  const wh = useMemo(() => new Map((whs.data ?? []).map((w) => [w.id, `${w.code}`])), [whs.data])
  const exit = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc('exit_employee', { p_employee_id: leaving!.id, p_exit_date: exitDate }); if (error) throw error },
    onSuccess: () => { toast.success(t('staff.exited')); setLeaving(null); void qc.invalidateQueries({ queryKey: ['employees'] }) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const rows = ((list.data ?? []) as Row[]).filter((r) => (showExited || r.status !== 'EXITED') && (!q || `${r.person?.full_name} ${r.code} ${r.person?.email}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <div>
      <PageHeader title={t('staff.title')} subtitle={t('staff.subtitle')} />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
          <Input aria-label={t('common.search')} placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} className="sm:w-64" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showExited} onChange={(e) => setShowExited(e.target.checked)} />{t('staff.showExited')}</label>
        </div>
        {list.isPending ? <div className="flex justify-center p-8"><Spinner /></div> : list.error ? <ErrorState message={t('common.error')} onRetry={() => list.refetch()} /> : !rows.length ? <EmptyState message={t('staff.none')} /> : (
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr>
            <th className="px-3 py-2">{t('common.code')}</th><th className="px-3 py-2">{t('common.name')}</th><th className="px-3 py-2">{t('hiring.jobRole')}</th><th className="px-3 py-2">{t('common.warehouse')}</th>
            <th className="px-3 py-2">{t('common.status')}</th><th className="px-3 py-2">{t('staff.joiningDate')}</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-50">{rows.map((r) => (
              <tr key={r.id} data-testid="employee-row"><td className="px-3 py-2 font-mono text-xs">{r.code}</td><td className="px-3 py-2"><div className="font-medium">{r.person?.full_name}</div><div className="text-xs text-slate-500">{r.person?.email}</div></td>
                <td className="px-3 py-2">{t(`jobRole.${r.job_role}`)}</td><td className="px-3 py-2">{r.warehouse_id ? wh.get(r.warehouse_id) : '—'}</td>
                <td className="px-3 py-2"><Badge tone={TONE[r.status]}>{t(`employeeStatus.${r.status}`)}</Badge>{r.exit_date && <div className="text-xs text-slate-500">{formatDate(r.exit_date, lang)}</div>}</td>
                <td className="px-3 py-2">{formatDate(r.joining_date, lang)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right"><Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(r)}>{t('common.edit')}</Button>
                  {isAdmin && <Button size="sm" variant="ghost" icon={<LockKeyhole className="h-4 w-4" />} onClick={() => setPriv(r)}>{t('staff.privateDetails')}</Button>}
                  {r.status !== 'EXITED' && r.user_id !== profile?.id && <Button size="sm" variant="ghost" icon={<UserMinus className="h-4 w-4" />} onClick={() => setLeaving(r)}>{t('staff.exit')}</Button>}</td></tr>))}</tbody></table></div>)}
      </Card>
      {edit && <EditDialog employee={edit} onClose={() => setEdit(null)} />}
      {priv && <PrivateDialog employee={priv} onClose={() => setPriv(null)} />}
      {leaving && <Modal open title={t('staff.exitTitle', { name: leaving.person?.full_name })} onClose={() => setLeaving(null)}
        footer={<><Button variant="secondary" onClick={() => setLeaving(null)}>{t('common.cancel')}</Button><Button variant="danger" loading={exit.isPending} onClick={() => exit.mutate()}>{t('staff.exit')}</Button></>}>
        <p className="mb-3 text-sm text-slate-600">{t('staff.exitHelp')}</p><Field label={t('staff.exitDate')} htmlFor="ex-date"><Input id="ex-date" type="date" min={leaving.joining_date} value={exitDate} onChange={(e) => setExitDate(e.target.value)} /></Field></Modal>}
    </div>
  )
}
