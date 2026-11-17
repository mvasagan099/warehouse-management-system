import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Power, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canWrite } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatNumber } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { BrigadeType, TablesUpdate } from '../../lib/types'
import { qk, useBrigadeTypes } from '../shared/queries'
import { brigadeTypeSchema, brigadeTypeToForm, emptyBrigadeType, previewVolume, type BrigadeTypeInput, type BrigadeTypeOutput } from './schema'

function BrigadeTypeForm({ initial, title, saving, onClose, onSubmit }: {
  initial: BrigadeTypeInput; title: string; saving: boolean; onClose: () => void; onSubmit: (v: BrigadeTypeOutput) => void
}) {
  const { t } = useTranslation()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<BrigadeTypeInput, unknown, BrigadeTypeOutput>({
    resolver: zodResolver(brigadeTypeSchema),
    defaultValues: initial,
  })
  const volume = previewVolume(watch('length_m'), watch('width_m'), watch('height_m'))
  const num = (name: 'length_m' | 'width_m' | 'height_m' | 'max_weight_kg', label: string) => (
    <Field label={label} htmlFor={`bt-${name}`} error={errors[name]?.message}>
      <Input id={`bt-${name}`} inputMode="decimal" {...register(name)} />
    </Field>
  )
  return (
    <Modal open title={title} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" form="bt-form" loading={saving}>{t('common.save')}</Button>
      </>
    }>
      <form id="bt-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('common.name')} htmlFor="bt-name" error={errors.name?.message} className="sm:col-span-2">
          <Input id="bt-name" {...register('name')} />
        </Field>
        {num('length_m', t('brigadeTypes.length'))}
        {num('width_m', t('brigadeTypes.width'))}
        {num('height_m', t('brigadeTypes.height'))}
        {num('max_weight_kg', t('brigadeTypes.maxWeight'))}
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm sm:col-span-2">
          {t('brigadeTypes.volume')}: <strong>{volume ?? '—'}</strong>
        </div>
        <Field label={t('brigadeTypes.description')} htmlFor="bt-desc" optional error={errors.description?.message} className="sm:col-span-2">
          <Textarea id="bt-desc" {...register('description')} />
        </Field>
      </form>
    </Modal>
  )
}

export function BrigadeTypesPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const writable = canWrite(profile?.role, 'brigadeTypes')
  const qc = useQueryClient()
  const list = useBrigadeTypes()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<BrigadeType | 'new' | null>(null)

  const done = (msg: string) => {
    toast.success(msg)
    void qc.invalidateQueries({ queryKey: qk.brigadeTypes })
  }

  const save = useMutation({
    mutationFn: async (v: BrigadeTypeOutput) => {
      const res = editing && editing !== 'new'
        ? await supabase.from('brigade_types').update(v).eq('id', editing.id)
        : await supabase.from('brigade_types').insert(v)
      if (res.error) throw res.error
    },
    onSuccess: () => { done(editing === 'new' ? t('brigadeTypes.added') : t('brigadeTypes.updated')); setEditing(null) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Pick<TablesUpdate<'brigade_types'>, 'is_default' | 'is_active'> }) => {
      if (patch.is_default) {
        // only one default allowed (unique partial index): clear the old one first
        const { error: clearErr } = await supabase.from('brigade_types').update({ is_default: false }).eq('is_default', true)
        if (clearErr) throw clearErr
      }
      const { error } = await supabase.from('brigade_types').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => done(t('brigadeTypes.updated')),
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const columns = useMemo<ColumnDef<BrigadeType>[]>(() => [
    {
      accessorKey: 'name',
      header: t('common.name'),
      cell: (c) => (
        <span className="inline-flex items-center gap-2 font-medium">
          {c.getValue<string>()}
          {c.row.original.is_default && <Badge tone="blue">{t('brigadeTypes.default')}</Badge>}
        </span>
      ),
    },
    {
      id: 'dims',
      header: `${t('brigadeTypes.dimensions')} (m)`,
      cell: (c) => `${c.row.original.length_m} × ${c.row.original.width_m} × ${c.row.original.height_m}`,
    },
    { accessorKey: 'volume_m3', header: t('brigadeTypes.volume'), cell: (c) => formatNumber(c.getValue<number>(), lang, 3) },
    { accessorKey: 'max_weight_kg', header: t('brigadeTypes.maxWeight'), cell: (c) => formatNumber(c.getValue<number>(), lang) },
    {
      accessorKey: 'is_active',
      header: t('common.status'),
      cell: (c) => (c.getValue() ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>),
    },
    ...(writable ? [{
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => {
        const b = row.original
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(b)}>{t('common.edit')}</Button>
            {!b.is_default && b.is_active && (
              <Button size="sm" variant="ghost" icon={<Star className="h-4 w-4" />} onClick={() => update.mutate({ id: b.id, patch: { is_default: true } })}>
                {t('brigadeTypes.makeDefault')}
              </Button>
            )}
            {!b.is_default && (
              <Button size="sm" variant="ghost" icon={<Power className="h-4 w-4" />} onClick={() => update.mutate({ id: b.id, patch: { is_active: !b.is_active } })}>
                {b.is_active ? t('common.deactivate') : t('common.activate')}
              </Button>
            )}
          </div>
        )
      },
    } satisfies ColumnDef<BrigadeType>] : []),
  ], [t, lang, writable, update])

  return (
    <div>
      <PageHeader
        title={t('brigadeTypes.title')}
        actions={writable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>{t('brigadeTypes.add')}</Button>}
      />
      <Card>
        <Toolbar>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-72" aria-label={t('common.search')} />
        </Toolbar>
        <DataTable data={list.data} columns={columns} loading={list.isPending} error={list.error ? t('common.error') : null} onRetry={() => list.refetch()} search={search} />
      </Card>
      {editing && (
        <BrigadeTypeForm
          title={editing === 'new' ? t('brigadeTypes.add') : t('brigadeTypes.edit')}
          initial={editing === 'new' ? emptyBrigadeType : brigadeTypeToForm(editing)}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(v) => save.mutate(v)}
        />
      )}
    </div>
  )
}
