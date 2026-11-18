/** Registers the service worker in production builds only (a worker in development hides code changes). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* the app still works online */ }) })
}

/** Error reporting: Sentry is loaded only when a DSN is configured, so the default bundle stays small. */
export function startErrorReporting() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return
  void import('@sentry/react').then((S) => S.init({
    dsn, environment: (import.meta.env.VITE_APP_ENV as string | undefined) ?? 'production', release: import.meta.env.VITE_APP_VERSION as string | undefined,
    sendDefaultPii: false, tracesSampleRate: 0,
    beforeSend(event) { if (event.request) { delete event.request.cookies; delete event.request.headers } return event },
  }))
}
