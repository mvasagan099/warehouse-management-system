import { createElement } from 'react'
import { supabase } from '../../lib/supabase'
import type { ChallanPdfData, ReceiptPdfData } from './documents'

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const fileSafe = (no: string) => no.replace(/[^A-Za-z0-9._-]+/g, '-')

/** The PDF renderer is large, so it is only loaded when someone clicks Download. */
export async function downloadReceiptPdf(data: ReceiptPdfData) {
  const [{ pdf }, { ReceiptPdf }] = await Promise.all([import('@react-pdf/renderer'), import('./documents')])
  const blob = await pdf(createElement(ReceiptPdf, data) as never).toBlob()
  save(blob, `${fileSafe(data.receipt.receipt_no)}.pdf`)
}

/** Reads the receiver's signature (private bucket) as a data URL so it can be embedded in the PDF. */
export async function signatureAsDataUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from('signatures').download(path)
  if (error || !data) return null
  return await new Promise((resolve) => {
    const r = new FileReader()
    r.onloadend = () => resolve(typeof r.result === 'string' ? r.result : null)
    r.readAsDataURL(data)
  })
}

export async function downloadChallanPdf(data: Omit<ChallanPdfData, 'signatureDataUrl'> & { signatureDataUrl?: string | null }) {
  const signatureDataUrl = data.signatureDataUrl ?? (await signatureAsDataUrl(data.challan.signature_path))
  const [{ pdf }, { ChallanPdf }] = await Promise.all([import('@react-pdf/renderer'), import('./documents')])
  const blob = await pdf(createElement(ChallanPdf, { ...data, signatureDataUrl }) as never).toBlob()
  save(blob, `${fileSafe(data.challan.challan_no)}.pdf`)
}
