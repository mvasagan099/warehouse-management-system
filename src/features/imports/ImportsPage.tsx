import { useMutation } from '@tanstack/react-query'
import { Download, FileCheck2, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field, Select } from '../../components/ui/Field'
import { Badge, Card, PageHeader } from '../../components/ui/misc'
import { downloadCsv, parseCsv, toCsv, type ParsedCsv } from '../../lib/csv'
import { errorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { missingColumns, templateCsv, type ImportKind } from './templates'

interface Report { kind: string; dry_run: boolean; rows: number; valid: number; imported: number; errors: { row: number; column: string | null; message: string }[] }
const KINDS: ImportKind[] = ['clients', 'companies', 'opening_stock', 'opening_balances']

/** Bring real data in: check the file first (nothing is saved), fix what the report lists, then import. A file with any error imports nothing. */
export function ImportsPage() {
  const { t } = useTranslation()
  const [kind, setKind] = useState<ImportKind>('clients')
  const [file, setFile] = useState<{ name: string; parsed: ParsedCsv } | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [checked, setChecked] = useState(false)
  const fileProblems = file ? [...file.parsed.errors, ...(missingColumns(kind, file.parsed.headers).map((c) => t('imports.missingColumn', { name: c })))] : []
  const reset = () => { setReport(null); setChecked(false) }
  const run = useMutation({
    mutationFn: async (dry: boolean) => {
      const { data, error } = await supabase.rpc('import_rows', { p_kind: kind, p_rows: file!.parsed.rows as never, p_dry_run: dry })
      if (error) throw error
      return { dry, report: data as unknown as Report }
    },
    onSuccess: ({ dry, report: r }) => { setReport(r); setChecked(dry && r.errors.length === 0); if (!dry && r.errors.length === 0) toast.success(t('imports.done', { count: r.imported })) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  const errorCsv = () => report && downloadCsv(`import-errors-${kind}.csv`, toCsv([{ key: 'row', label: 'Row' }, { key: 'column', label: 'Column' }, { key: 'message', label: 'Problem' }], report.errors as never))
  return (
    <div>
      <PageHeader title={t('imports.title')} subtitle={t('imports.subtitle')} />
      <Card className="mb-4 space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('imports.what')} htmlFor="im-kind"><Select id="im-kind" value={kind} onChange={(e) => { setKind(e.target.value as ImportKind); setFile(null); reset() }} className="min-w-64">{KINDS.map((k) => <option key={k} value={k}>{t(`imports.kinds.${k}`)}</option>)}</Select></Field>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => downloadCsv(`template-${kind}.csv`, templateCsv(kind))}>{t('imports.template')}</Button>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"><Upload className="h-4 w-4" />{t('imports.chooseFile')}
            <input type="file" accept=".csv,text/csv" className="sr-only" aria-label={t('imports.chooseFile')} data-testid="import-file" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; reset(); setFile({ name: f.name, parsed: parseCsv(await f.text()) }) }} /></label>
        </div>
        <p className="text-sm text-slate-600">{t(`imports.help.${kind}`)}</p>
        {file && (
          <div className="space-y-3 text-sm">
            <div><span className="font-medium">{file.name}</span> · {t('imports.rowsFound', { count: file.parsed.rows.length })}</div>
            {fileProblems.length > 0 && <ul className="list-disc rounded-lg bg-red-50 p-3 pl-6 text-red-800" role="alert">{fileProblems.map((p) => <li key={p}>{p}</li>)}</ul>}
            <div className="flex flex-wrap gap-2">
              <Button icon={<FileCheck2 className="h-4 w-4" />} disabled={fileProblems.length > 0 || !file.parsed.rows.length} loading={run.isPending && run.variables === true} onClick={() => run.mutate(true)}>{t('imports.check')}</Button>
              <Button variant="secondary" disabled={!checked} loading={run.isPending && run.variables === false} onClick={() => run.mutate(false)} data-testid="import-run">{t('imports.run')}</Button>
            </div>
          </div>)}
      </Card>
      {report && (
        <Card className="p-4" data-testid="import-report">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><Badge tone={report.errors.length ? 'red' : 'green'}>{report.errors.length ? t('imports.hasErrors', { count: report.errors.length }) : report.dry_run ? t('imports.allGood') : t('imports.imported')}</Badge>
            <span>{t('imports.summary', { rows: report.rows, valid: report.valid })}</span>{report.dry_run && !report.errors.length && <span className="text-slate-500">{t('imports.nothingSaved')}</span>}</div>
          {report.errors.length > 0 && (<>
            <div className="max-h-72 overflow-auto"><table className="min-w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="px-2 py-1">{t('imports.row')}</th><th className="px-2 py-1">{t('imports.column')}</th><th className="px-2 py-1">{t('imports.problem')}</th></tr></thead>
              <tbody>{report.errors.map((e, i) => <tr key={i} className="border-t border-slate-100"><td className="px-2 py-1">{e.row}</td><td className="px-2 py-1">{e.column ?? '—'}</td><td className="px-2 py-1">{e.message}</td></tr>)}</tbody></table></div>
            <Button className="mt-3" size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={errorCsv}>{t('imports.errorReport')}</Button></>)}
        </Card>)}
    </div>
  )
}
