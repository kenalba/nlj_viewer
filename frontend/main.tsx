import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppRouter } from './AppRouter.tsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { QueryProvider } from './contexts/QueryContext'
import { XAPIProvider } from './contexts/XAPIContext'
import { AudioProvider } from './contexts/AudioContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <AudioProvider>
            <XAPIProvider>
              <AppRouter />
            </XAPIProvider>
          </AudioProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>,
)
