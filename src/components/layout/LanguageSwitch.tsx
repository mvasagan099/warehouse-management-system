import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../../i18n'
import { supabase } from '../../lib/supabase'

export function LanguageSwitch({ userId }: { userId?: string }) {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage ?? 'en'

  const change = async (lng: 'en' | 'ta') => {
    await i18n.changeLanguage(lng)
    // remember the choice on the profile too (self-editable column); ignore failures
    if (userId) await supabase.from('profiles').update({ preferred_language: lng }).eq('id', userId)
  }

  return (
    <label className="flex items-center gap-1.5 text-sm text-slate-600">
      <Languages className="h-4 w-4" aria-hidden />
      <span className="sr-only">{t('header.language')}</span>
      <select
        aria-label={t('header.language')}
        value={current}
        onChange={(e) => change(e.target.value as 'en' | 'ta')}
        className="rounded-md border border-slate-300 bg-white py-1 pl-2 pr-7 text-sm"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </label>
  )
}
