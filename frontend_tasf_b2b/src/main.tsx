import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { SimulationProvider } from './contexts/SimulationContext'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <SimulationProvider>
        <RouterProvider router={router} />
      </SimulationProvider>
    </AuthProvider>
  </React.StrictMode>
)
