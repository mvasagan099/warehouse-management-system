import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} aria-hidden />
}

export function FullPageSpinner() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full min-h-60 items-center justify-center gap-2 text-slate-500" role="status">
      <Spinner /> <span>{t('common.loading')}</span>
    </div>
  )
}
