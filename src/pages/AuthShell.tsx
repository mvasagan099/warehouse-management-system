import { Logo } from '../components/Logo'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { InstallApp } from '../components/InstallApp'
import { LanguageSwitch } from '../components/layout/LanguageSwitch'

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-ink p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-2">
          <div>
            <Logo />
            <div className="mt-2 text-xs text-slate-500">{t('app.tagline')}</div>
          </div>
        </div>
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {children}
      </div>
      <InstallApp className="mt-4 bg-white" />
      <div className="mt-4 rounded-lg bg-white/90 px-3 py-1.5">
        <LanguageSwitch />
      </div>
    </div>
  )
}
