import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Card, EmptyState, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { useClients } from '../shared/queries'
import { CompaniesDialog } from './CompaniesDialog'

/** Senders and receivers: pick a client, then add or edit the companies its lorries come from and go to. */
export function CompaniesPage() {
  const { t } = useTranslation()
  const clients = useClients()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<{ id: string; name: string } | null>(null)
  const rows = (clients.data ?? []).filter((c) => c.status === 'ACTIVE' && `${c.code} ${c.company_name}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <PageHeader title={t('companies.pageTitle')} subtitle={t('companies.pageHelp')} />
      <Card>
        <div className="border-b border-slate-100 p-3"><Input aria-label={t('common.search')} placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} className="sm:w-72" /></div>
        {clients.isPending ? <div className="flex justify-center p-8"><Spinner /></div> : !rows.length ? <EmptyState message={t('companies.noClients')} /> : (
          <ul className="divide-y divide-slate-100 text-sm">{rows.map((c) => (
            <li key={c.id} className="flex min-h-14 items-center justify-between gap-2 px-4 py-2"><span><span className="font-mono text-xs text-slate-500">{c.code}</span> <span className="font-medium">{c.company_name}</span></span>
              <Button size="sm" variant="secondary" icon={<Building className="h-4 w-4" />} onClick={() => setOpen({ id: c.id, name: c.company_name })}>{t('companies.title')}</Button></li>))}</ul>)}
      </Card>
      {open && <CompaniesDialog clientId={open.id} clientName={open.name} onClose={() => setOpen(null)} />}
    </div>
  )
}
