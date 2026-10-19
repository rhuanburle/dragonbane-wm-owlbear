// Entrada do popover da extensão (as telas estão em App.tsx).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { CSS } from './App'

const style = document.createElement('style')
style.textContent = CSS
document.head.appendChild(style)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
