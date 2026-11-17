import { Eraser } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

/**
 * Canvas signature capture (mouse, touch or pen). Calls onChange with a PNG Blob
 * after each stroke, or null when cleared. Used as the receiver's proof of delivery.
 */
export function SignaturePad({ onChange, height = 160 }: { onChange: (png: Blob | null) => void; height?: number }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  const prepare = useCallback(() => {
    const c = ref.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    const w = c.clientWidth
    c.width = Math.max(1, Math.floor(w * ratio))
    c.height = Math.floor(height * ratio)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
  }, [height])

  useEffect(() => { prepare() }, [prepare])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = point(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + 0.01, p.y + 0.01)
    ctx.stroke()
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    const p = point(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    drawing.current = false
    setEmpty(false)
    e.currentTarget.toBlob((b) => onChange(b), 'image/png')
  }
  const clear = () => {
    const c = ref.current
    if (!c) return
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={ref}
        style={{ height, touchAction: 'none' }}
        className="w-full cursor-crosshair rounded-lg border border-dashed border-slate-400 bg-white"
        aria-label={t('challans.signatureHere')}
        data-testid="signature-canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
      />
      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
        <span>{empty ? t('challans.signatureHere') : t('challans.signatureCaptured')}</span>
        <Button size="sm" variant="ghost" onClick={clear} icon={<Eraser className="h-4 w-4" />}>{t('common.clear')}</Button>
      </div>
    </div>
  )
}
