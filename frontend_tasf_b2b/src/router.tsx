import { createBrowserRouter, Navigate, useNavigate, useParams } from 'react-router'

import AppLayout from './layouts/AppLayout'
import SimulationPage from './pages/SimulationPage'
import DailyOperationPage from './pages/DailyOperationPage'
import FlightDetailPage from './pages/FlightDetailPage'
import WarehouseDetailPage from './pages/WarehouseDetailPage'

import FlightsCrud from './components/FlightsCrud'
import AirportsCrud from './components/AirportsCrud'
import ShipmentsCrud from './components/ShipmentsCrud'

import { PlaneIconDebug } from './debug/PlaneIconDebug'

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
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/simulacion" replace />,
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
        element: <FlightsRoute />,
      },
      {
        path: 'vuelos/:flightId',
        element: <FlightDetailRoute />,
      },
      {
        path: 'aeropuertos',
        element: <AirportsRoute />,
      },
      {
        path: 'aeropuertos/:airportCode/almacen',
        element: <AirportWarehouseRoute />,
      },
      {
        path: 'simulacion',
        element: <SimulationRoute />,
      },
      {
        path: 'debug',
        element: <PlaneIconDebug />,
      },
      {
        path: 'reportes',
        element: <div>Reportes</div>,
      },
      {
        path: 'configuracion',
        element: <div>Configuración</div>,
      },
    ],
  },
])
