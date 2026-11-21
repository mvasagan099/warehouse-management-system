import clsx from 'clsx'
import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

type Tone = 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'cyan' | 'violet'
const tones: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  cyan: 'bg-cyan-50 text-cyan-800 ring-cyan-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
}

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent', tones[tone])}>
      {children}
    </span>
  )
}

export function PageHeader({ title, actions, subtitle }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)]', className)}>{children}</div>
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center text-slate-500">
      <Inbox className="h-10 w-10 text-slate-300" aria-hidden />
      <p className="text-sm">{message}</p>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
      {message}
      {onRetry && (
        <button className="ml-3 font-medium underline" onClick={onRetry}>
          {retryLabel ?? 'Retry'}
        </button>
      )}
    </div>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 border-b border-slate-200 p-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
}
