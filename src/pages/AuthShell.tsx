import { Snowflake } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitch } from '../components/layout/LanguageSwitch'

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-brand-800 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Snowflake className="h-7 w-7 text-brand-600" aria-hidden />
            <div>
              <div className="font-semibold leading-tight">{t('app.name')}</div>
              <div className="text-xs text-slate-500">{t('app.tagline')}</div>
            </div>
          </div>
        </div>
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {children}
      </div>
      <div className="mt-4 rounded-lg bg-white/90 px-3 py-1.5">
        <LanguageSwitch />
      </div>
    </div>
  )
}
