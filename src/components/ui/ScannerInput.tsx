import { Camera, CameraOff, ScanLine } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { Input } from './Field'

/**
 * Scan a QR / barcode with the camera, or type / paste (USB scanners type into the
 * box and press Enter). Calls onScan(code) once per scan.
 */
export function ScannerInput({ onScan, autoFocus }: { onScan: (code: string) => void; autoFocus?: boolean }) {
  const { t } = useTranslation()
  const regionId = useId().replace(/:/g, '')
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null)
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })

  useEffect(() => {
    if (!cameraOn) return
    let cancelled = false
    ;(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return
        const scanner = new Html5Qrcode(regionId)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            const now = Date.now()
            if (decoded === lastRef.current.code && now - lastRef.current.at < 2500) return // ignore repeats
            lastRef.current = { code: decoded, at: now }
            onScan(decoded)
          },
          () => {},
        )
      } catch (e) {
        setCameraError(e instanceof Error ? e.message : String(e))
        setCameraOn(false)
      }
    })()
    return () => {
      cancelled = true
      const sc = scannerRef.current
      scannerRef.current = null
      if (sc) sc.stop().then(() => sc.clear()).catch(() => {})
    }
  }, [cameraOn, regionId, onScan])

  const submit = () => {
    const v = text.trim()
    if (!v) return
    setText('')
    onScan(v)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
          <Input
            value={text}
            autoFocus={autoFocus}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
            placeholder={t('scan.placeholder')}
            aria-label={t('scan.placeholder')}
            className="pl-9 text-base"
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={submit}>{t('scan.lookup')}</Button>
        <Button
          className="flex-1"
          variant={cameraOn ? 'danger' : 'primary'}
          onClick={() => { setCameraError(null); setCameraOn((v) => !v) }}
          icon={cameraOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        >
          {cameraOn ? t('scan.stopCamera') : t('scan.camera')}
        </Button>
        </div>
      </div>
      {cameraError && <p className="text-sm text-red-600" role="alert">{t('scan.cameraError')}: {cameraError}</p>}
      <div id={regionId} className={cameraOn ? 'mx-auto max-w-sm overflow-hidden rounded-lg' : 'hidden'} />
    </div>
  )
}
