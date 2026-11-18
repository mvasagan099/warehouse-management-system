import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Catches any screen that crashes so the person sees a clear message and a Reload button instead of a blank white page.
 * The most common cause is a new version being published while the app is open: the old screen files no longer exist.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error', error, info.componentStack)
    if (isStaleBundle(error)) reloadOnce()
    else void import('@sentry/react').then((S) => S.captureException(error)).catch(() => {})
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm" role="alert">
          <h1 className="mb-2 text-lg font-semibold">Something went wrong / ஏதோ தவறு நேர்ந்தது</h1>
          <p className="mb-4 text-sm text-slate-600">{isStaleBundle(this.state.error) ? 'A new version is available. Reload to continue. / புதிய பதிப்பு உள்ளது. தொடர மீண்டும் ஏற்றவும்.' : 'Your saved work on this phone is safe. Reload the app. / உங்கள் சேமித்த பதிவுகள் பாதுகாப்பாக உள்ளன. செயலியை மீண்டும் ஏற்றவும்.'}</p>
          <button className="min-h-11 rounded-lg bg-brand-700 px-5 py-2 font-medium text-white hover:bg-brand-800" onClick={() => location.reload()}>Reload / மீண்டும் ஏற்று</button>
        </div>
      </div>
    )
  }
}

export const isStaleBundle = (e: unknown) => /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(String((e as Error)?.message ?? e))

/** One automatic reload per minute at most, so a real fault can never loop. */
export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem('wms.reloaded') ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem('wms.reloaded', String(Date.now()))
  } catch { /* storage blocked: still reload once */ }
  location.reload()
}
