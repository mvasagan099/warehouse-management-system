import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { supabase } from '../../lib/supabase'

/** Authenticator-app (TOTP) enrolment and sign-in check. Used full-screen when two-factor is required, and inside the admin page. */
export function MfaPanel({ onVerified, compact }: { onVerified: () => void; compact?: boolean }) {
  const { t } = useTranslation()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [enrol, setEnrol] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void supabase.auth.mfa.listFactors().then(({ data }) => { if (live) setFactorId(data?.totp?.find((f) => f.status === 'verified')?.id ?? null) })
    return () => { live = false }
  }, [])

  const startEnrol = async () => {
    setError(null)
    const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` })
    if (e || !data) return setError(e?.message ?? t('mfa.failed'))
    setEnrol({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }
  const verify = async () => {
    const id = enrol?.id ?? factorId
    if (!id) return
    setBusy(true); setError(null)
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code: code.trim() })
    setBusy(false)
    if (e) { setError(t('mfa.wrongCode')); return }
    await supabase.auth.refreshSession()
    toast.success(t('mfa.verified')); setCode(''); setEnrol(null); onVerified()
  }
  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {!factorId && !enrol && (<><p className="text-sm text-slate-600">{t('mfa.enrolHelp')}</p><Button onClick={startEnrol}>{t('mfa.setUp')}</Button></>)}
      {enrol && (
        <div className="space-y-3 text-sm">
          <p>{t('mfa.scan')}</p>
          <img src={enrol.qr} alt={t('mfa.qrAlt')} className="h-44 w-44 rounded border border-slate-200 bg-white p-1" />
          <p className="break-all text-xs text-slate-500">{t('mfa.orType')} <code>{enrol.secret}</code></p>
        </div>)}
      {(factorId || enrol) && (
        <div className="space-y-3">
          <Field label={t('mfa.code')} htmlFor="mfa-code" hint={t('mfa.codeHint')}><Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></Field>
          {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>}
          <Button loading={busy} disabled={code.length !== 6} onClick={verify} className="w-full sm:w-auto">{t('mfa.verify')}</Button>
        </div>)}
      {error && !factorId && !enrol && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </div>
  )
}
