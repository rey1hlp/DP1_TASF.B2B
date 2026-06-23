import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { SimulationProvider } from './contexts/SimulationContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SimulationProvider>
      <RouterProvider router={router} />
    </SimulationProvider>
  </React.StrictMode>
)
