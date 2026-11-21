import clsx from 'clsx'
import { ChevronsUpDown, Search } from 'lucide-react'
import { Children, forwardRef, isValidElement, useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'

const control =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-red-500'

export interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  optional?: boolean
  className?: string
  children: ReactNode
}

/** Label + control + translated validation message. Zod messages are i18n keys. */
export function Field({ label, htmlFor, error, hint, optional, className, children }: FieldProps) {
  const { t } = useTranslation()
  return (
    <div className={clsx('space-y-1', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">({t('common.optional')})</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600" role="alert" id={`${htmlFor}-error`}>
          {t(error, { defaultValue: error, max: 20000 })}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={clsx(control, className)} {...props} />
})

interface Opt { value: string; label: string; disabled: boolean }

/** Flattens <option> children (also inside fragments and arrays) into plain data. */
function optionsOf(children: ReactNode): Opt[] {
  const out: Opt[] = []
  const walk = (nodes: ReactNode) => {
    Children.forEach(nodes, (c) => {
      if (!isValidElement(c)) return
      const el = c as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>
      if (el.type === 'option') out.push({ value: String(el.props.value ?? ''), label: textOf(el.props.children), disabled: !!el.props.disabled })
      else if (el.props?.children) walk(el.props.children)
    })
  }
  walk(children)
  return out
}
const textOf = (n: ReactNode): string => (typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(textOf).join('') : isValidElement(n) ? textOf((n as ReactElement<{ children?: ReactNode }>).props.children) : '')

/** More than this many choices and the list gets a search box. */
const SEARCH_ABOVE = 6

/**
 * A normal select for short lists. With many choices (clients, warehouses...) it becomes a search box with suggestions:
 * type part of a name or code and the list narrows. The real <select> stays in the page (hidden), so forms, validation and tests behave as before.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  const { t } = useTranslation()
  const inner = useRef<HTMLSelectElement | null>(null)
  const setRefs = (el: HTMLSelectElement | null) => { inner.current = el; if (typeof ref === 'function') ref(el); else if (ref) (ref as { current: HTMLSelectElement | null }).current = el }
  const opts = optionsOf(children)
  // clients, warehouses, companies and the like always get the search box (the lists keep growing); other lists only when long
  const entity = /client|warehouse|company|compan|zone|slot|vacancy|user|customer/i.test(`${props.id ?? ''} ${props.name ?? ''} ${props['aria-label'] ?? ''}`)
  const count = opts.filter((o) => o.value !== '').length
  const searchable = count > 1 && (entity || count > SEARCH_ABOVE)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [label, setLabel] = useState('')
  const root = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  // keep the shown text in step with the real select (react-hook-form sets its value without events)
  useEffect(() => {
    const el = inner.current
    const text = el ? (el.selectedOptions[0]?.text ?? '') : ''
    if (text !== label) setLabel(text)
  })
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!searchable) {
    return (
      <select ref={setRefs} className={clsx(control, 'pr-8', className)} {...props}>
        {children}
      </select>
    )
  }

  const shown = opts.filter((o) => o.value !== '' && (q.trim() === '' || q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => o.label.toLowerCase().includes(w))))
  const placeholder = opts.find((o) => o.value === '')?.label || t('common.select')
  const choose = (o: Opt) => {
    const el = inner.current
    if (el) { el.value = o.value; el.dispatchEvent(new Event('change', { bubbles: true })) }
    setLabel(o.label); setOpen(false); setQ('')
  }
  const clear = () => { const el = inner.current; if (el) { el.value = ''; el.dispatchEvent(new Event('change', { bubbles: true })) } setLabel(''); setOpen(false) }
  const hasEmpty = opts.some((o) => o.value === '')
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) choose(shown[active]) }
    else if (e.key === 'Escape') setOpen(false)
  }
  return (
    <div ref={root} className="relative">
      <select ref={setRefs} className="sr-only" tabIndex={-1} aria-hidden {...props}>{children}</select>
      <button type="button" id={props.id} disabled={props.disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        className={clsx(control, 'flex items-center justify-between pr-3 text-left', !label && 'text-slate-400', className)}
        onClick={() => { setOpen(!open); setActive(0) }}>
        <span className="truncate">{label || placeholder}</span><ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-48 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2"><Search className="h-4 w-4 text-slate-400" aria-hidden />
            <input autoFocus role="combobox" aria-expanded aria-controls={listId} aria-label={t('common.search')} placeholder={t('common.search')} value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0) }} onKeyDown={onKey} className="w-full bg-transparent text-sm outline-none" /></div>
          <ul id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1 text-sm">
            {hasEmpty && q === '' && <li role="option" aria-selected={!label}><button type="button" className="block w-full px-3 py-2 text-left text-slate-400 hover:bg-slate-50" onClick={clear}>{placeholder}</button></li>}
            {shown.map((o, i) => (
              <li key={o.value} role="option" aria-selected={o.label === label}>
                <button type="button" disabled={o.disabled} onMouseEnter={() => setActive(i)} onClick={() => choose(o)}
                  className={clsx('block w-full px-3 py-2 text-left', i === active ? 'bg-brand-50' : '', o.label === label ? 'font-medium text-brand-700' : '', o.disabled && 'opacity-50')}>{o.label}</button>
              </li>))}
            {shown.length === 0 && <li className="px-3 py-3 text-slate-500">{t('common.noMatches')}</li>}
          </ul>
        </div>)}
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} rows={3} className={clsx(control, className)} {...props} />
  },
)

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600" {...props} />
      {label}
    </label>
  )
}
