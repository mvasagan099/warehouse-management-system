import clsx from 'clsx'
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'

const control =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-red-500'

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

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={clsx(control, 'pr-8', className)} {...props}>
      {children}
    </select>
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
