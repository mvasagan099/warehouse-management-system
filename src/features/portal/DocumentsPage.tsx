import { useQuery } from '@tanstack/react-query'
import { Download, FileArchive } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Badge, Card, EmptyState, ErrorState, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { formatINR } from '../../lib/money'
import { saveBlob } from '../pdf/download'
import { useSetting } from '../shared/queries'
import { buildPdf, docFileName, listDocuments, type DocKind, type DocRow } from './documents'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const istToday = () => iso(new Date(Date.now() + 5.5 * 3600_000))
const KINDS: DocKind[] = ['RECEIPT', 'CHALLAN', 'INVOICE', 'CREDIT_NOTE', 'TEMP_REPORT']

/** All of a client's documents as PDFs, filterable by date, one at a time or a whole period as a ZIP. */
export function DocumentsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const clientId = profile?.client_id ?? ''
  const terms = useSetting<string>('invoice_terms', '')
  const [from, setFrom] = useState(iso(new Date(Date.now() + 5.5 * 3600_000 - 30 * 86400000)))
  const [to, setTo] = useState(istToday())
  const [kind, setKind] = useState<'' | DocKind>('')
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const list = useQuery({ queryKey: ['portal_docs', clientId, from, to], enabled: !!clientId && !!from && !!to && to >= from, queryFn: () => listDocuments(clientId, from, to) })
  const rows = (list.data ?? []).filter((r) => !kind || r.kind === kind)

  const one = async (d: DocRow) => {
    setBusy(d.kind + d.id)
    try { saveBlob(await buildPdf(d, clientId, from, to, terms.data), docFileName(d)) } catch (e) { toast.error(await errorMessage(e)) } finally { setBusy(null) }
  }
  const zip = async () => {
    setBusy('zip'); setProgress(`0 / ${rows.length}`)
    try {
      const { zipSync } = await import('fflate')
      const files: Record<string, Uint8Array> = {}
      let n = 0
      for (const d of rows) {
        const blob = await buildPdf(d, clientId, from, to, terms.data)
        files[`${d.kind.toLowerCase()}/${docFileName(d)}`] = new Uint8Array(await blob.arrayBuffer())
        setProgress(`${++n} / ${rows.length}`)
      }
      const z = zipSync(files, { level: 0 })
      saveBlob(new Blob([z.buffer as ArrayBuffer], { type: 'application/zip' }), `documents-${from}-to-${to}.zip`)
    } catch (e) { toast.error(await errorMessage(e)) } finally { setBusy(null); setProgress(null) }
  }
  return (
    <div>
      <PageHeader title={t('docs.title')} subtitle={t('docs.subtitle')} />
      <Card className="mb-4 p-4"><div className="flex flex-wrap items-end gap-3">
        <Field label={t('billing.periodFrom')} htmlFor="dc-from"><Input id="dc-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={t('billing.periodTo')} htmlFor="dc-to"><Input id="dc-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label={t('docs.kind')} htmlFor="dc-kind"><Select id="dc-kind" value={kind} onChange={(e) => setKind(e.target.value as DocKind | '')}><option value="">{t('common.all')}</option>{KINDS.map((k) => <option key={k} value={k}>{t(`docs.kinds.${k}`)}</option>)}</Select></Field>
        <Button icon={<FileArchive className="h-4 w-4" />} disabled={!rows.length} loading={busy === 'zip'} onClick={zip}>{progress ? `${t('docs.preparing')} ${progress}` : t('docs.downloadZip', { count: rows.length })}</Button>
      </div></Card>
      <Card>
        {list.isPending && list.fetchStatus !== 'idle' ? <div className="flex justify-center p-8"><Spinner /></div> : list.error ? <ErrorState message={t('common.error')} onRetry={() => list.refetch()} /> : !rows.length ? <EmptyState message={t('docs.none')} /> : (
          <ul className="divide-y divide-slate-100 text-sm">{rows.map((d) => (
            <li key={d.kind + d.id} className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-2" data-testid="doc-row">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="blue">{t(`docs.kinds.${d.kind}`)}</Badge><span className="font-medium">{d.no}</span><span className="text-slate-500">{formatDate(d.date, lang)}</span>{d.amountPaise !== undefined && <span>{formatINR(d.amountPaise)}</span>}</div>
              <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} loading={busy === d.kind + d.id} onClick={() => one(d)}>{t('common.downloadPdf')}</Button></li>))}</ul>)}
      </Card>
    </div>
  )
}
