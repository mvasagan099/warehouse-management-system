import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** "Install app" button: uses the browser's install prompt where there is one, and shows steps on iPhone/iPad. Hidden once installed. */
export function InstallApp({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [help, setHelp] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent) }
    const onInstalled = () => { setInstalled(true); setEvt(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  if (installed || (!evt && !isIos())) return null

  const click = async () => {
    if (evt) {
      await evt.prompt()
      await evt.userChoice
      setEvt(null)
    } else setHelp(true)
  }

  return (
    <>
      <button type="button" onClick={click} className={`inline-flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 ${className}`}>
        <Download className="h-4 w-4" aria-hidden /> {t('install.button')}
      </button>
      {help && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal onClick={() => setHelp(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><b>{t('install.title')}</b><button type="button" aria-label={t('common.close', 'Close')} onClick={() => setHelp(false)}><X className="h-4 w-4" /></button></div>
            <p className="text-slate-600">{t('install.iosSteps')}</p>
          </div>
        </div>
      )}
    </>
  )
}
