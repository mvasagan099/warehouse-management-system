import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileDown, FileText, Plus, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/misc'
import { fetchPrivateBlob, openPrivateFile, safeFileName } from '../../lib/download'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatDateTime } from '../../lib/format'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import type { Applicant, InterviewRound, Vacancy } from '../../lib/types'
import { offerLetterBlob, saveBlob } from '../pdf/download'
import { useSetting } from '../shared/queries'

const folder = (a: Applicant) => a.warehouse_id ?? 'hq'

/** Everything about one applicant: source, private resume, interview rounds with scores and the offer letter. */
export function ApplicantDetail({ applicant, vacancy, onClose, onChanged }: { applicant: Applicant; vacancy?: Vacancy; onClose: () => void; onChanged: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const qc = useQueryClient()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'SUPER_ADMIN'
  const supplier = useSetting<{ name?: string; address?: string }>('supplier', {})
  const rounds = useQuery({
    queryKey: ['rounds', applicant.id],
    queryFn: async () => { const { data, error } = await supabase.from('interview_rounds').select('*').eq('applicant_id', applicant.id).order('round_no'); if (error) throw error; return data as InterviewRound[] },
  })
  const salary = useQuery({
    queryKey: ['vacancy_salary', vacancy?.id], enabled: isAdmin && !!vacancy,
    queryFn: async () => { const { data, error } = await supabase.from('vacancy_salaries').select('*').eq('vacancy_id', vacancy!.id).maybeSingle(); if (error) throw error; return data },
  })
  const [source, setSource] = useState(applicant.source ?? '')
  const [round, setRound] = useState({ scheduled_at: '', interviewer: '', notes: '', score: '' })
  const [joining, setJoining] = useState(applicant.expected_joining ?? '')
  const [busy, setBusy] = useState(false)
  const fail = async (e: unknown) => toast.error(await errorMessage(e))
  const done = () => { onChanged(); void qc.invalidateQueries({ queryKey: ['hiring'] }) }

  const saveSource = useMutation({
    mutationFn: async () => { const { error } = await supabase.from('applicants').update({ source: source.trim() || null, expected_joining: joining || null }).eq('id', applicant.id); if (error) throw error },
    onSuccess: () => { toast.success(t('hiring.saved')); done() }, onError: fail,
  })
  const addRound = useMutation({
    mutationFn: async () => {
      const next = (rounds.data?.reduce((n, r) => Math.max(n, r.round_no), 0) ?? 0) + 1
      const { error } = await supabase.from('interview_rounds').insert({ applicant_id: applicant.id, round_no: next, scheduled_at: new Date(round.scheduled_at).toISOString(), interviewer: round.interviewer.trim(),
        notes: round.notes.trim() || null, score: round.score === '' ? null : Number(round.score) } as never)
      if (error) throw error
    },
    onSuccess: () => { setRound({ scheduled_at: '', interviewer: '', notes: '', score: '' }); void rounds.refetch() }, onError: fail,
  })
  const upload = async (file: File) => {
    setBusy(true)
    try {
      const path = `resume/${folder(applicant)}/${applicant.id}/${Date.now()}-${safeFileName(file.name)}`
      const up = await supabase.storage.from('hr').upload(path, file, { contentType: file.type })
      if (up.error) throw up.error
      const { error } = await supabase.from('applicants').update({ resume_path: path }).eq('id', applicant.id)
      if (error) throw error
      toast.success(t('hiring.resumeSaved')); done()
    } catch (e) { await fail(e) } finally { setBusy(false) }
  }
  const makeOffer = async () => {
    setBusy(true)
    try {
      const sal = salary.data
      const blob = await offerLetterBlob({
        company: supplier.data?.name ?? t('app.name'), address: supplier.data?.address, candidate: applicant.full_name, position: vacancy?.title ?? '', warehouse: vacancy?.warehouse_id ? t('hiring.thisWarehouse') : t('hiring.headOffice'),
        joiningDate: joining ? formatDate(joining, lang) : '—', issuedOn: formatDate(new Date().toISOString(), lang), signatory: profile?.full_name ?? '',
        salaryText: isAdmin && sal ? `${formatINR(sal.min_paise)} - ${formatINR(sal.max_paise)} per month` : null,
      })
      const path = `offer/${folder(applicant)}/${applicant.id}/offer-letter.pdf`
      const up = await supabase.storage.from('hr').upload(path, blob, { contentType: 'application/pdf', upsert: true })
      if (up.error) throw up.error
      const { error } = await supabase.from('applicants').update({ offer_letter_path: path, offer_issued_at: new Date().toISOString(), status: applicant.status === 'JOINED' ? 'JOINED' : 'OFFERED' }).eq('id', applicant.id)
      if (error) throw error
      saveBlob(blob, `offer-${safeFileName(applicant.full_name)}.pdf`); toast.success(t('hiring.offerSaved')); done()
    } catch (e) { await fail(e) } finally { setBusy(false) }
  }

  return (
    <Modal open size="lg" title={applicant.full_name} onClose={onClose}>
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-2"><Badge tone="blue">{t(`applicantStatus.${applicant.status}`)}</Badge>{vacancy && <span className="text-slate-500">{vacancy.title}</span>}
          <span className="text-slate-500">{[applicant.phone, applicant.email].filter(Boolean).join(' · ')}</span></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('hiring.source')} htmlFor="ap-src" optional><Input id="ap-src" value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('hiring.sourceHint')} /></Field>
          <Field label={t('hiring.expectedJoining')} htmlFor="ap-join" optional><Input id="ap-join" type="date" value={joining} onChange={(e) => setJoining(e.target.value)} /></Field>
          <div className="sm:col-span-2"><Button size="sm" variant="secondary" loading={saveSource.isPending} onClick={() => saveSource.mutate()}>{t('common.save')}</Button></div>
        </div>

        <section aria-label={t('hiring.resume')}>
          <h3 className="mb-2 font-semibold">{t('hiring.resume')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {applicant.resume_path ? <Button size="sm" variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={() => openPrivateFile('hr', applicant.resume_path!).catch(fail)}>{t('hiring.openResume')}</Button> : <span className="text-slate-500">{t('hiring.noResume')}</span>}
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
              <Upload className="h-4 w-4" />{busy ? t('common.loading') : t('hiring.uploadResume')}
              <input type="file" accept="application/pdf,image/*" className="sr-only" aria-label={t('hiring.uploadResume')} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }} />
            </label>
          </div>
          <p className="mt-1 text-xs text-slate-500">{t('hiring.resumePrivate')}</p>
        </section>

        <section aria-label={t('hiring.rounds')}>
          <h3 className="mb-2 font-semibold">{t('hiring.rounds')}</h3>
          <ul className="mb-3 space-y-1">{(rounds.data ?? []).map((r) => (
            <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{t('hiring.round', { n: r.round_no })} · {r.interviewer}</span>
              <span className="text-slate-500">{formatDateTime(r.scheduled_at, lang)}{r.score != null ? ` · ${t('hiring.score')} ${r.score}/10` : ''}</span></div>{r.notes && <div className="text-slate-600">{r.notes}</div>}</li>))}
            {!rounds.data?.length && <li className="text-slate-500">{t('hiring.noRounds')}</li>}</ul>
          <div className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
            <Field label={t('hiring.roundDate')} htmlFor="rd-date"><Input id="rd-date" type="datetime-local" value={round.scheduled_at} onChange={(e) => setRound({ ...round, scheduled_at: e.target.value })} /></Field>
            <Field label={t('hiring.interviewer')} htmlFor="rd-who"><Input id="rd-who" value={round.interviewer} onChange={(e) => setRound({ ...round, interviewer: e.target.value })} /></Field>
            <Field label={t('hiring.score')} htmlFor="rd-score" optional><Select id="rd-score" value={round.score} onChange={(e) => setRound({ ...round, score: e.target.value })}><option value="">—</option>{Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}</option>)}</Select></Field>
            <Field label={t('common.notes')} htmlFor="rd-notes" optional><Textarea id="rd-notes" rows={2} value={round.notes} onChange={(e) => setRound({ ...round, notes: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Button size="sm" icon={<Plus className="h-4 w-4" />} disabled={!round.scheduled_at || !round.interviewer.trim()} loading={addRound.isPending} onClick={() => addRound.mutate()}>{t('hiring.addRound')}</Button></div>
          </div>
        </section>

        <section aria-label={t('hiring.offer')}>
          <h3 className="mb-2 font-semibold">{t('hiring.offer')}</h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<FileDown className="h-4 w-4" />} loading={busy} onClick={makeOffer}>{applicant.offer_letter_path ? t('hiring.regenerateOffer') : t('hiring.makeOffer')}</Button>
            {applicant.offer_letter_path && <Button size="sm" variant="secondary" onClick={async () => { try { saveBlob(await fetchPrivateBlob('hr', applicant.offer_letter_path!), `offer-${safeFileName(applicant.full_name)}.pdf`) } catch (e) { await fail(e) } }}>{t('hiring.downloadOffer')}</Button>}
          </div>
          {applicant.offer_issued_at && <p className="mt-1 text-xs text-slate-500">{t('hiring.offerIssued', { date: formatDate(applicant.offer_issued_at, lang) })}</p>}
        </section>
      </div>
    </Modal>
  )
}
