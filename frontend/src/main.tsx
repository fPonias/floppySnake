import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CookiesProvider } from 'react-cookie'

createRoot(document.getElementById('minusOne')!).render(
        <CookiesProvider defaultSetOptions={{ path: '/' }} >
            <App />
        </CookiesProvider>
)
