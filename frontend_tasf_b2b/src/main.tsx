import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SimulationProvider } from './contexts/SimulationContext'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element not found')
}

createRoot(root).render(
  <StrictMode>
    <SimulationProvider>
      <App />
    </SimulationProvider>
  </StrictMode>
)
