import { Camera, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage } from '../../lib/errors'
import { compressImage } from '../../lib/image'
import { supabase } from '../../lib/supabase'
import { Button } from './Button'

const BUCKET = 'gate-photos'

/** Signed (temporary) URLs for private photos. */
// Signed URLs are remembered for 50 minutes so the same photo keeps the same URL: the browser then reuses its cached copy instead of downloading it again on every visit.
const signedCache = new Map<string, { url: string; exp: number }>()

export function useSignedUrls(paths: string[], bucket = BUCKET) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = paths.join('|')
  useEffect(() => {
    let alive = true
    if (!paths.length) { setUrls({}); return }
    const now = Date.now()
    const hit: Record<string, string> = {}
    const missing: string[] = []
    for (const p of paths) { const c = signedCache.get(`${bucket}/${p}`); if (c && c.exp > now) hit[p] = c.url; else missing.push(p) }
    setUrls(hit)
    if (!missing.length) return
    supabase.storage.from(bucket).createSignedUrls(missing, 3600).then(({ data }) => {
      if (!alive || !data) return
      for (const d of data) if (d.signedUrl && d.path) { signedCache.set(`${bucket}/${d.path}`, { url: d.signedUrl, exp: Date.now() + 50 * 60_000 }); hit[d.path] = d.signedUrl }
      setUrls({ ...hit })
    })
    return () => { alive = false }
  }, [key, bucket])
  return urls
}

/** Camera / gallery upload to the private gate-photos bucket: <warehouse id>/<folder>/<random>.<ext> */
export function PhotoUpload({
  warehouseId, folder, paths, onChange, disabled, max = 12,
}: {
  warehouseId: string
  folder: string
  paths: string[]
  onChange: (paths: string[]) => void | Promise<void>
  disabled?: boolean
  max?: number
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const urls = useSignedUrls(paths)

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      const added: string[] = []
      for (const original of Array.from(files).slice(0, max - paths.length)) {
        const file = await compressImage(original)
        const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
        const path = `${warehouseId}/${folder}/${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
        if (error) throw error
        added.push(path)
      }
      await onChange([...paths, ...added])
    } catch (e) {
      toast.error(await errorMessage(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {paths.map((p) => (
          <div key={p} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {urls[p] && <img src={urls[p]} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
            {!disabled && (
              <button
                type="button"
                aria-label={t('common.remove')}
                className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-slate-700"
                onClick={() => onChange(paths.filter((x) => x !== p))}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {!disabled && paths.length < max && (
        <>
          <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => upload(e.target.files)} data-testid="photo-input" />
          <Button variant="secondary" loading={busy} onClick={() => input.current?.click()} icon={<Camera className="h-4 w-4" />}>
            {t('common.addPhoto')}
          </Button>
        </>
      )}
    </div>
  )
}
