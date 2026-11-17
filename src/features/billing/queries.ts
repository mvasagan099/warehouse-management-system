import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// RLS decides what each role gets back (drafts: admin and accountant only; clients: their own issued invoices).
export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(1000)
      if (error) throw error
      return data
    },
  })
}

export function useInvoiceDetail(id: string | null) {
  return useQuery({
    queryKey: ['invoice', id],
    enabled: !!id,
    queryFn: async () => {
      const [inv, lines, tax, notes, allocs] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', id!).single(),
        supabase.from('invoice_lines').select('*').eq('invoice_id', id!).order('section').order('line_no'),
        supabase.from('invoice_tax_lines').select('*').eq('invoice_id', id!).order('section'),
        supabase.from('adjustment_notes').select('*').eq('invoice_id', id!).order('created_at'),
        supabase.from('payment_allocations').select('*').eq('doc_type', 'INVOICE').eq('doc_id', id!),
      ])
      for (const r of [inv, lines, tax, notes, allocs]) if (r.error) throw r.error
      return { invoice: inv.data!, lines: lines.data!, tax: tax.data!, notes: notes.data!, allocations: allocs.data! }
    },
  })
}

export function useOtherCharges() {
  return useQuery({
    queryKey: ['other_charges'],
    queryFn: async () => {
      const { data, error } = await supabase.from('other_charges').select('*').is('deleted_at', null).order('name')
      if (error) throw error
      return data
    },
  })
}

export function useClientGroups() {
  return useQuery({
    queryKey: ['client_groups'],
    queryFn: async () => {
      const { data, error } = await supabase.from('client_groups').select('*').is('deleted_at', null).order('name')
      if (error) throw error
      return data
    },
  })
}
