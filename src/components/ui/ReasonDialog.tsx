import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { Field, Textarea } from './Field'
import { Modal } from './Modal'

/** Asks for a mandatory reason before a cancel / reject / adjust action. */
export function ReasonDialog({
  open, title, message, confirmLabel, danger = true, loading, onConfirm, onClose,
}: {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const invalid = touched && reason.trim() === ''
  const close = () => { setReason(''); setTouched(false); onClose() }
  return (
    <Modal
      open={open}
      title={title}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>{t('common.cancel')}</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={() => {
              setTouched(true)
              if (reason.trim()) onConfirm(reason.trim())
            }}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      {message && <p className="mb-3 text-sm text-slate-600">{message}</p>}
      <Field label={t('common.reasonRequired')} htmlFor="reason-text" error={invalid ? 'validation.required' : undefined}>
        <Textarea id="reason-text" value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={invalid} autoFocus />
      </Field>
    </Modal>
  )
}
