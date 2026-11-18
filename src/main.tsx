import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import './i18n'
import './index.css'
import { registerServiceWorker, startErrorReporting } from './lib/pwa'

startErrorReporting()
registerServiceWorker()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster richColors position="top-center" closeButton />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
