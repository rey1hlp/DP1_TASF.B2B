import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, useLocation, useNavigate, useParams } from 'react-router'

import AppLayout from './layouts/AppLayout'
import SimulationPage from './pages/SimulationPage'
import DailyOperationPage from './pages/DailyOperationPage'
import FlightDetailPage from './pages/FlightDetailPage'
import WarehouseDetailPage from './pages/WarehouseDetailPage'
import LoginPage from './pages/LoginPage'
import EmployeesCrud from './components/EmployeesCrud'

import FlightsCrud from './components/FlightsCrud'
import AirportsCrud from './components/AirportsCrud'
import ShipmentsCrud from './components/ShipmentsCrud'
import OccupancyReport from './components/OccupancyReport'

import { PlaneIconDebug } from './debug/PlaneIconDebug'
import { useAuth } from './contexts/AuthContext'

type AllowedRole = 'ADMIN' | 'LOGISTICS' | 'REGISTER'

function RequireAuth() {
  const location = useLocation()
  const { isAuthenticated, status } = useAuth()

  if (status === 'loading') {
    return <div className="route-loading">Cargando sesiÃ³n...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <AppLayout />
}

function getDefaultRoute(role?: AllowedRole | null) {
  if (role === 'LOGISTICS') return '/operacion-diaria'
  if (role === 'REGISTER') return '/envios'
  if (role === 'ADMIN') return '/simulacion'
  return '/operacion-diaria'
}

function RequireRoles({
  allow,
  children,
}: {
  allow: AllowedRole[]
  children: ReactNode
}) {
  const { user } = useAuth()

  if (!user || !allow.includes(user.role as AllowedRole)) {
    return <Navigate to={getDefaultRoute(user?.role as AllowedRole | undefined)} replace />
  }

  return children
}

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={getDefaultRoute(user?.role as AllowedRole | undefined)} replace />
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
        element: (
          <RequireRoles allow={['ADMIN', 'LOGISTICS']}>
            <DailyOperationPage />
          </RequireRoles>
        ),
      },
      {
        path: 'envios',
        element: (
          <RequireRoles allow={['ADMIN', 'REGISTER']}>
            <ShipmentsCrud />
          </RequireRoles>
        ),
      },
      {
        path: 'vuelos',
        element: (
          <RequireRoles allow={['ADMIN']}>
            <FlightsRoute />
          </RequireRoles>
        ),
      },
      {
        path: 'vuelos/:flightId',
        element: (
          <RequireRoles allow={['ADMIN']}>
            <FlightDetailRoute />
          </RequireRoles>
        ),
      },
      {
        path: 'aeropuertos',
        element: (
          <RequireRoles allow={['ADMIN']}>
            <AirportsRoute />
          </RequireRoles>
        ),
      },
      {
        path: 'aeropuertos/:airportCode/almacen',
        element: (
          <RequireRoles allow={['ADMIN']}>
            <AirportWarehouseRoute />
          </RequireRoles>
        ),
      },
      {
        path: 'simulacion',
        element: (
          <RequireRoles allow={['ADMIN']}>
            <SimulationRoute />
          </RequireRoles>
        ),
      },
      {
        path: 'reportes',
        element: (
          <RequireRoles allow={['ADMIN']}>
            <OccupancyReport />
          </RequireRoles>
        ),
      },
      {
        path: 'configuracion',
        element: (
          <RequireRoles allow={['ADMIN']}>
            <div>ConfiguraciÃ³n</div>
          </RequireRoles>
        ),
      },
      {
        path: 'debug',
        element: (
          <RequireRoles allow={['ADMIN']}>
            <PlaneIconDebug />
          </RequireRoles>
        ),
      },
      {
        path: 'usuarios',
        element: (
          <RequireRoles allow={['ADMIN']}>
            <EmployeesCrud />
          </RequireRoles>
        ),
      },
    ],
  },
])
