import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, useLocation, useNavigate, useParams } from 'react-router'

import AppLayout from './layouts/AppLayout'
import SimulationPage from './pages/SimulationPage'
import DailyOperationPage from './pages/DailyOperationPage'
import FlightDetailPage from './pages/FlightDetailPage'
import WarehouseDetailPage from './pages/WarehouseDetailPage'
import LoginPage from './pages/LoginPage'

import FlightsCrud from './components/FlightsCrud'
import AirportsCrud from './components/AirportsCrud'
import ShipmentsCrud from './components/ShipmentsCrud'
import OccupancyReport from './components/OccupancyReport'

import { PlaneIconDebug } from './debug/PlaneIconDebug'
import { useAuth } from './contexts/AuthContext'

function RequireAuth() {
  const location = useLocation()
  const { isAuthenticated, status } = useAuth()

  if (status === 'loading') {
    return <div className="route-loading">Cargando sesión...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <AppLayout />
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    return <Navigate to="/operacion-diaria" replace />
  }

  return children
}

function HomeRedirect() {
  const { isAdmin } = useAuth()
  return <Navigate to={isAdmin ? '/simulacion' : '/operacion-diaria'} replace />
}

function FlightsRoute() {
  const navigate = useNavigate()

  return (
    <FlightsCrud
      onViewDetail={(id) => {
        navigate(`/vuelos/${id}`)
      }}
    />
  )
}

function FlightDetailRoute() {
  const navigate = useNavigate()
  const { flightId } = useParams()

  const parsedFlightId = Number(flightId)

  if (!flightId || Number.isNaN(parsedFlightId)) {
    return <Navigate to="/vuelos" replace />
  }

  return (
    <FlightDetailPage
      flightId={parsedFlightId}
      onVolver={() => navigate('/vuelos')}
    />
  )
}

function AirportsRoute() {
  const navigate = useNavigate()

  return (
    <AirportsCrud
      onViewDetail={(codigoOaci) => {
        navigate(`/aeropuertos/${codigoOaci}/almacen`)
      }}
    />
  )
}

function AirportWarehouseRoute() {
  const navigate = useNavigate()
  const { airportCode } = useParams()

  if (!airportCode) {
    return <Navigate to="/aeropuertos" replace />
  }

  return (
    <WarehouseDetailPage
      airportCode={airportCode}
      onVolver={() => navigate('/aeropuertos')}
    />
  )
}

function SimulationRoute() {
  return <SimulationPage />
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        index: true,
        element: <HomeRedirect />,
      },
      {
        path: 'operacion-diaria',
        element: <DailyOperationPage />,
      },
      {
        path: 'envios',
        element: <ShipmentsCrud />,
      },
      {
        path: 'vuelos',
        element: <RequireAdmin><FlightsRoute /></RequireAdmin>,
      },
      {
        path: 'vuelos/:flightId',
        element: <RequireAdmin><FlightDetailRoute /></RequireAdmin>,
      },
      {
        path: 'aeropuertos',
        element: <RequireAdmin><AirportsRoute /></RequireAdmin>,
      },
      {
        path: 'aeropuertos/:airportCode/almacen',
        element: <RequireAdmin><AirportWarehouseRoute /></RequireAdmin>,
      },
      {
        path: 'simulacion',
        element: <RequireAdmin><SimulationRoute /></RequireAdmin>,
      },
      {
        path: 'debug',
        element: <RequireAdmin><PlaneIconDebug /></RequireAdmin>,
      },
      {
        path: 'reportes',
        element: <RequireAdmin><OccupancyReport /></RequireAdmin>,
      },
      {
        path: 'configuracion',
        element: <RequireAdmin><div>Configuración</div></RequireAdmin>,
      },
    ],
  },
])
