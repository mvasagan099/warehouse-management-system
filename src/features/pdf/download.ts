import { createElement } from 'react'
import { supabase } from '../../lib/supabase'
import type { OfferLetterData } from './hrDocuments'
import type { ChallanPdfData, ClientTempReportPdfData, EvidencePackPdfData, InvoicePdfData, ReceiptPdfData, RegisterPdfData } from './documents'

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

/** A UPI QR for the balance, when the supplier has a UPI id and something is still owed. */
async function upiQrFor(data: InvoicePdfData): Promise<string | null> {
  const sup = (data.invoice.supplier_snapshot ?? {}) as Record<string, string | null | undefined>
  const due = data.invoice.grand_total_paise - data.invoice.paid_paise - data.invoice.credit_paise
  if (!sup.upi_id || due <= 0 || !data.invoice.invoice_no) return null
  try {
    const QR = await import('qrcode')
    const url = `upi://pay?pa=${encodeURIComponent(String(sup.upi_id))}&pn=${encodeURIComponent(String(sup.legal_name || sup.name || 'Warehouse'))}&am=${(due / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${data.invoice.invoice_no}`)}`
    return await QR.toDataURL(url, { margin: 1, width: 180 })
  } catch { return null }
}

/** Renders the tax invoice PDF in the browser (the renderer is loaded on demand). */
export async function invoicePdfBlob(data: InvoicePdfData): Promise<Blob> {
  const [{ pdf }, { InvoicePdf }] = await Promise.all([import('@react-pdf/renderer'), import('./documents')])
  return await pdf(createElement(InvoicePdf, { ...data, upiQr: data.upiQr ?? (await upiQrFor(data)) }) as never).toBlob()
}

export async function downloadInvoicePdf(data: InvoicePdfData) {
  const blob = await invoicePdfBlob(data)
  save(blob, `${fileSafe(data.invoice.invoice_no ?? 'draft-invoice')}.pdf`)
}

async function toBlobFrom(element: (m: typeof import('./documents')) => unknown): Promise<Blob> {
  const [{ pdf }, docs] = await Promise.all([import('@react-pdf/renderer'), import('./documents')])
  return await pdf(element(docs) as never).toBlob()
}

export async function downloadClientTempReportPdf(data: ClientTempReportPdfData) {
  save(await toBlobFrom((m) => createElement(m.ClientTempReportPdf, data)), `temperature-report-${fileSafe(data.client.company_name)}-${data.from}-${data.to}.pdf`)
}

/** Manual-reading photos taken during the event are embedded in the pack (read from the private bucket). */
export async function downloadEvidencePackPdf(data: Omit<EvidencePackPdfData, 'photos'>) {
  const photos: string[] = []
  if (data.sensor) {
    const from = new Date(Date.parse(data.alert.event_start) - 30 * 60_000).toISOString()
    const { data: rows } = await supabase.from('readings').select('photo_path').eq('sensor_id', data.sensor.id).gte('recorded_at', from).lte('recorded_at', data.alert.recovered_at ?? new Date().toISOString()).not('photo_path', 'is', null).limit(4)
    for (const r of rows ?? []) {
      const f = await supabase.storage.from('coldchain').download(r.photo_path as string)
      if (f.data && /image\/(png|jpeg)/.test(f.data.type)) photos.push(await new Promise<string>((res) => { const fr = new FileReader(); fr.onloadend = () => res(String(fr.result)); fr.readAsDataURL(f.data) }))
    }
  }
  save(await toBlobFrom((m) => createElement(m.EvidencePackPdf, { ...data, photos, generatedAt: new Date().toISOString() })), `evidence-pack-${data.alert.id.slice(0, 8)}.pdf`)
}

export async function downloadRegisterPdf(data: RegisterPdfData, filename: string) {
  save(await toBlobFrom((m) => createElement(m.RegisterPdf, data)), `${fileSafe(filename)}.pdf`)
}

/** Renders the offer letter. The caller uploads it to the private HR bucket and/or saves it. */
export async function offerLetterBlob(data: OfferLetterData): Promise<Blob> {
  const [{ pdf }, { OfferLetterPdf }] = await Promise.all([import('@react-pdf/renderer'), import('./hrDocuments')])
  return await pdf(createElement(OfferLetterPdf, data) as never).toBlob()
}

export function saveBlob(blob: Blob, filename: string) { save(blob, filename) }

export async function receiptPdfBlob(data: ReceiptPdfData): Promise<Blob> {
  return toBlobFrom((m) => createElement(m.ReceiptPdf, data))
}
export async function challanPdfBlob(data: Omit<ChallanPdfData, 'signatureDataUrl'> & { signatureDataUrl?: string | null }): Promise<Blob> {
  const signatureDataUrl = data.signatureDataUrl ?? (await signatureAsDataUrl(data.challan.signature_path))
  return toBlobFrom((m) => createElement(m.ChallanPdf, { ...data, signatureDataUrl }))
}
export async function tempReportPdfBlob(data: ClientTempReportPdfData): Promise<Blob> {
  return toBlobFrom((m) => createElement(m.ClientTempReportPdf, data))
}
export async function registerPdfBlob(data: RegisterPdfData): Promise<Blob> {
  return toBlobFrom((m) => createElement(m.RegisterPdf, data))
}
