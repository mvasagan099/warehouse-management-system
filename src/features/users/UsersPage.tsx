import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Building2, Plus, Power } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { creatableRoles } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Checkbox, Input, Select } from '../../components/ui/Field'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'
import { useWarehouses } from '../shared/queries'
import { CreateUserDialog } from './CreateUserDialog'

function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: assignments, error: aErr }] = await Promise.all([
        supabase.from('profiles').select('*').neq('role', 'CLIENT').is('deleted_at', null).order('full_name'),
        supabase.from('warehouse_managers').select('id, warehouse_id, user_id').is('deleted_at', null),
      ])
      if (error) throw error
      if (aErr) throw aErr
      return { profiles, assignments }
    },
  })
}

function AssignmentsDialog({ user, current, onClose, onSaved }: {
  user: Profile; current: { id: string; warehouse_id: string }[]; onClose: () => void; onSaved: () => void
}) {
  const { t } = useTranslation()
  const warehouses = useWarehouses()
  const [selected, setSelected] = useState<string[]>(current.map((c) => c.warehouse_id))
  const save = useMutation({
    mutationFn: async () => {
      const toAdd = selected.filter((w) => !current.some((c) => c.warehouse_id === w))
      const toRemove = current.filter((c) => !selected.includes(c.warehouse_id))
      if (toAdd.length) {
        const { error } = await supabase.from('warehouse_managers').insert(toAdd.map((warehouse_id) => ({ warehouse_id, user_id: user.id })))
        if (error) throw error
      }
      if (toRemove.length) {
        // soft delete
        const { error } = await supabase.from('warehouse_managers').update({ deleted_at: new Date().toISOString() }).in('id', toRemove.map((r) => r.id))
        if (error) throw error
      }
    },
    onSuccess: () => { toast.success(t('users.updated')); onSaved() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={`${t('users.manageAssignments')} — ${user.full_name}`} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
      </>
    }>
      <div className="grid gap-2 sm:grid-cols-2">
        {warehouses.data?.map((w) => (
          <Checkbox key={w.id} label={`${w.code} · ${w.name}`} checked={selected.includes(w.id)}
            onChange={(e) => setSelected(e.target.checked ? [...selected, w.id] : selected.filter((x) => x !== w.id))} />
        ))}
      </div>
    </Modal>
  )
}

export function UsersPage() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'SUPER_ADMIN'
  const canCreate = creatableRoles(profile?.role).length > 0
  const qc = useQueryClient()
  const users = useUsers()
  const warehouses = useWarehouses()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [toggling, setToggling] = useState<Profile | null>(null)
  const [assigning, setAssigning] = useState<Profile | null>(null)

  const whLabel = useMemo(() => new Map((warehouses.data ?? []).map((w) => [w.id, w.code])), [warehouses.data])
  const assignmentsOf = useCallback(
    (userId: string) => (users.data?.assignments ?? []).filter((a) => a.user_id === userId),
    [users.data],
  )
  const refresh = () => void qc.invalidateQueries({ queryKey: ['users'] })

  const toggle = useMutation({
    mutationFn: async (u: Profile) => {
      const { error } = await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id)
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('users.updated')); setToggling(null); refresh() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const rows = useMemo(() => (users.data?.profiles ?? []).filter((p) => !roleFilter || p.role === roleFilter), [users.data, roleFilter])

  const columns = useMemo<ColumnDef<Profile>[]>(() => [
    {
      accessorKey: 'full_name',
      header: t('users.fullName'),
      cell: (c) => (
        <div>
          <div className="font-medium">{c.getValue<string>()}</div>
          {c.row.original.must_change_password && <Badge tone="amber">{t('users.mustChange')}</Badge>}
        </div>
      ),
    },
    { accessorKey: 'email', header: t('common.email') },
    { accessorKey: 'phone', header: t('common.phone'), cell: (c) => c.getValue<string | null>() ?? '—' },
    { accessorKey: 'role', header: t('common.role'), cell: (c) => <Badge tone={c.getValue() === 'SUPER_ADMIN' ? 'violet' : c.getValue() === 'WAREHOUSE_MANAGER' ? 'blue' : 'gray'}>{t(`roles.${c.getValue<string>()}`)}</Badge> },
    {
      id: 'warehouses',
      header: t('users.assignments'),
      accessorFn: (p) =>
        p.role === 'STAFF'
          ? (p.warehouse_id ? whLabel.get(p.warehouse_id) ?? '' : '')
          : assignmentsOf(p.id).map((a) => whLabel.get(a.warehouse_id) ?? '').join(', '),
      cell: (c) => c.getValue<string>() || t('users.none'),
    },
    { accessorKey: 'is_active', header: t('common.status'), cell: (c) => (c.getValue() ? <Badge tone="green">{t('common.active')}</Badge> : <Badge tone="red">{t('common.inactive')}</Badge>) },
    { accessorKey: 'created_at', header: t('common.createdAt'), cell: (c) => formatDate(c.getValue<string>(), i18n.resolvedLanguage) },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => {
        const u = row.original
        const canToggle = u.id !== profile?.id && (isAdmin || u.role === 'STAFF')
        return (
          <div className="flex gap-1">
            {isAdmin && u.role === 'WAREHOUSE_MANAGER' && (
              <Button size="sm" variant="ghost" icon={<Building2 className="h-4 w-4" />} onClick={() => setAssigning(u)}>{t('users.manageAssignments')}</Button>
            )}
            {canToggle && (
              <Button size="sm" variant="ghost" icon={<Power className="h-4 w-4" />} onClick={() => setToggling(u)}>
                {u.is_active ? t('common.deactivate') : t('common.activate')}
              </Button>
            )}
          </div>
        )
      },
    },
  ], [t, i18n.resolvedLanguage, whLabel, assignmentsOf, isAdmin, profile?.id])

  return (
    <div>
      <PageHeader title={t('users.title')} actions={canCreate && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>{t('users.add')}</Button>} />
      <Card>
        <Toolbar>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-72" aria-label={t('common.search')} />
          <Select aria-label={t('common.role')} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="sm:w-52">
            <option value="">{t('common.all')}</option>
            {(['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF', 'ACCOUNTANT'] as const).map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
          </Select>
        </Toolbar>
        <DataTable data={rows} columns={columns} loading={users.isPending} error={users.error ? t('common.error') : null} onRetry={() => users.refetch()} search={search} filtered={!!roleFilter} />
      </Card>
      {creating && <CreateUserDialog title={t('users.add')} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh() }} />}
      {assigning && (
        <AssignmentsDialog user={assigning} current={assignmentsOf(assigning.id)} onClose={() => setAssigning(null)} onSaved={() => { setAssigning(null); refresh() }} />
      )}
      <ConfirmDialog
        open={!!toggling}
        title={toggling?.is_active ? t('common.deactivate') : t('common.activate')}
        message={toggling ? t(toggling.is_active ? 'users.deactivateConfirm' : 'users.activateConfirm', { name: toggling.full_name }) : ''}
        danger={toggling?.is_active}
        loading={toggle.isPending}
        onConfirm={() => toggling && toggle.mutate(toggling)}
        onClose={() => setToggling(null)}
      />
    </div>
  )
}
