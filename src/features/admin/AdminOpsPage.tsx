import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DatabaseBackup, ShieldCheck, Timer } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input } from '../../components/ui/Field'
import { Badge, Card, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { openPrivateFile } from '../../lib/download'
import { errorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { MfaPanel } from '../security/MfaScreen'
import { useSetting } from '../shared/queries'

function CronCard() {
  const { t, i18n } = useTranslation()
  const q = useQuery({ queryKey: ['cron_state'], refetchInterval: 60_000, queryFn: async () => { const { data, error } = await supabase.from('cron_job_state').select('*').order('job'); if (error) throw error; return data } })
  const now = Date.now()
  return (
    <Card className="p-4"><h2 className="mb-1 flex items-center gap-2 font-semibold"><Timer className="h-4 w-4" />{t('ops.cronTitle')}</h2><p className="mb-3 text-sm text-slate-500">{t('ops.cronHelp')}</p>
      {q.isPending ? <Spinner /> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1 pr-3">{t('ops.job')}</th><th className="py-1 pr-3">{t('common.status')}</th><th className="py-1 pr-3">{t('ops.lastOk')}</th><th className="py-1">{t('ops.runs')}</th></tr></thead>
        <tbody>{(q.data ?? []).map((j) => {
          const stale = !j.last_ok_at || now - Date.parse(j.last_ok_at) > j.max_age_minutes * 60_000
          const bad = j.last_status === 'FAILED' || stale
          return <tr key={j.job} className="border-t border-slate-100" data-testid="cron-row"><td className="py-1.5 pr-3 font-mono text-xs">{j.job}</td>
            <td className="py-1.5 pr-3"><Badge tone={bad ? 'red' : 'green'}>{j.last_status === 'FAILED' ? t('ops.failed') : stale ? t('ops.notRunning') : t('ops.ok')}</Badge>{j.last_error && <div className="max-w-md truncate text-xs text-red-700" title={j.last_error}>{j.last_error}</div>}</td>
            <td className="py-1.5 pr-3">{j.last_ok_at ? formatDateTime(j.last_ok_at, i18n.resolvedLanguage) : '—'}</td><td className="py-1.5">{j.runs}</td></tr>
        })}</tbody></table></div>}
    </Card>
  )
}

function BackupCard() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['backup_files'],
    queryFn: async () => {
      const { data: dirs, error } = await supabase.storage.from('backups').list('daily', { limit: 100, sortBy: { column: 'name', order: 'desc' } })
      if (error) throw error
      const latest = dirs?.[0]?.name
      if (!latest) return { latest: null as string | null, files: [] as { name: string; size: number }[] }
      const { data: files } = await supabase.storage.from('backups').list(`daily/${latest}`, { limit: 100 })
      return { latest, files: (files ?? []).map((f) => ({ name: f.name, size: Number((f.metadata as { size?: number } | null)?.size ?? 0) })) }
    },
  })
  const run = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.functions.invoke('backup-export', { body: {} }); if (error) throw error; return data as { folder: string } },
    onSuccess: (d) => { toast.success(t('ops.backupDone', { folder: d.folder })); void qc.invalidateQueries({ queryKey: ['backup_files'] }) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Card className="p-4"><h2 className="mb-1 flex items-center gap-2 font-semibold"><DatabaseBackup className="h-4 w-4" />{t('ops.backupTitle')}</h2><p className="mb-3 text-sm text-slate-500">{t('ops.backupHelp')}</p>
      <Button size="sm" loading={run.isPending} onClick={() => run.mutate()}>{t('ops.backupNow')}</Button>
      {list.isPending ? <Spinner /> : !list.data?.latest ? <p className="mt-3 text-sm text-slate-500">{t('ops.noBackups')}</p> : (
        <div className="mt-3 text-sm"><div className="mb-1 font-medium">{t('ops.latest')}: {list.data.latest} · {t('ops.files', { count: list.data.files.length })}</div>
          <ul className="max-h-40 overflow-y-auto text-xs">{list.data.files.map((f) => <li key={f.name}><button className="text-brand-700 hover:underline" onClick={() => openPrivateFile('backups', `daily/${list.data!.latest}/${f.name}`).catch(async (e) => toast.error(await errorMessage(e)))}>{f.name}</button> <span className="text-slate-400">{Math.round(f.size / 1024)} KB</span></li>)}</ul>
          <p className="mt-1 text-xs text-slate-400">{formatDateTime(new Date().toISOString(), i18n.resolvedLanguage)}</p></div>)}
    </Card>
  )
}

function SecurityCard() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const st = useQuery({ queryKey: ['security_state_admin'], queryFn: async () => { const { data, error } = await supabase.rpc('my_security_state'); if (error) throw error; return data as unknown as { mfa_required: boolean; aal: string } } })
  const factors = useQuery({ queryKey: ['mfa_factors'], queryFn: async () => (await supabase.auth.mfa.listFactors()).data?.totp?.filter((f) => f.status === 'verified') ?? [] })
  const set = useMutation({
    mutationFn: async (on: boolean) => { const { error } = await supabase.rpc('set_require_admin_mfa', { p_on: on }); if (error) throw error },
    onSuccess: () => { toast.success(t('common.saved')); void qc.invalidateQueries({ queryKey: ['security_state_admin'] }); void qc.invalidateQueries({ queryKey: ['security_state'] }) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const refresh = () => { void st.refetch(); void factors.refetch() }
  return (
    <Card className="p-4"><h2 className="mb-1 flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />{t('ops.securityTitle')}</h2><p className="mb-3 text-sm text-slate-500">{t('ops.mfaHelp')}</p>
      {st.isPending ? <Spinner /> : (<div className="space-y-3 text-sm">
        <div>{factors.data?.length ? <Badge tone="green">{t('ops.mfaEnrolled')}</Badge> : <Badge tone="amber">{t('ops.mfaNotEnrolled')}</Badge>}</div>
        {st.data?.aal !== 'aal2' && <><p className="text-slate-600">{t(factors.data?.length ? 'ops.mfaVerifyFirst' : 'ops.mfaEnrolFirst')}</p><MfaPanel compact onVerified={refresh} /></>}
        <Checkbox label={t('ops.mfaRequire')} checked={!!st.data?.mfa_required} disabled={set.isPending || (st.data?.aal !== 'aal2' && !st.data?.mfa_required)} onChange={(e) => set.mutate(e.target.checked)} />
        <p className="text-xs text-slate-500">{t('ops.passwordRules')}</p>
      </div>)}
    </Card>
  )
}

function RetentionCard() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const cur = useSetting<Record<string, number>>('retention', {})
  const [f, setF] = useState<Record<string, string>>({})
  const keys = ['notifications_days', 'outbox_days', 'cron_runs_days', 'soft_deleted_days'] as const
  const save = useMutation({
    mutationFn: async () => {
      const value = { ...(cur.data ?? {}), ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '').map(([k, v]) => [k, Math.max(1, Math.trunc(Number(v)))])) }
      const { error } = await supabase.from('app_settings').update({ value }).eq('key', 'retention'); if (error) throw error
    },
    onSuccess: () => { toast.success(t('common.saved')); setF({}); void qc.invalidateQueries({ queryKey: ['app_settings'] }) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Card className="p-4"><h2 className="mb-1 font-semibold">{t('ops.retentionTitle')}</h2><p className="mb-3 text-sm text-slate-500">{t('ops.retentionHelp')}</p>
      <div className="grid gap-3 sm:grid-cols-2">{keys.map((k) => <Field key={k} label={t(`ops.retention.${k}`)} htmlFor={`ret-${k}`}><Input id={`ret-${k}`} type="number" min={1} value={f[k] ?? String(cur.data?.[k] ?? '')} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}</div>
      <p className="mt-2 text-xs text-slate-500">{t('ops.retentionFinancial')}</p>
      <Button className="mt-3" size="sm" loading={save.isPending} disabled={!Object.keys(f).length} onClick={() => save.mutate()}>{t('common.save')}</Button>
    </Card>
  )
}

export function AdminOpsPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <PageHeader title={t('ops.title')} subtitle={t('ops.subtitle')} actions={<Link to="/audit" className="text-sm font-medium text-brand-700 hover:underline">{t('nav.audit')}</Link>} />
      <CronCard /><div className="grid gap-4 lg:grid-cols-2"><BackupCard /><SecurityCard /></div><RetentionCard />
    </div>
  )
}
