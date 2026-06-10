import { useState } from 'react'
import SimulationPage from './pages/SimulationPage'
import FlightsCrud from './components/FlightsCrud'
import AirportsCrud from './components/AirportsCrud'
import ShipmentsCrud from './components/ShipmentsCrud'
import DailyOperationPage from './pages/DailyOperationPage'
import FlightDetailPage from './pages/FlightDetailPage'
import WarehouseDetailPage from './pages/WarehouseDetailPage'

export default function App() {
  const [activeSection, setActiveSection] = useState<
    'daily' | 'sim' | 'flights' | 'airports' | 'shipments' | 'flight-detail' | 'airport-detail'
  >('sim')

  // Estado para almacenar el ID o Código del elemento seleccionado para el detalle
  const [selectedId, setSelectedId] = useState<number | string | null>(null)

  return (
    <div className="app">
      <header className="sidebar">
        <div className="brand">
          <div className="logo">TB</div>
          <div>
            <div className="brand-title">Tasf.B2B</div>
            <div className="brand-subtitle">Air Logistics</div>
          </div>
        </div>

        <div className="profile">
          <div className="avatar">ER</div>
          <div>
            <div className="profile-name">Esteban Ramirez</div>
            <div className="profile-role">Supervisor de operaciones</div>
          </div>
        </div>

        <nav className="nav">
          <button
            className={`nav-item ${activeSection === "daily" ? "active" : ""}`}
            onClick={() => setActiveSection("daily")}
          >
            Operación diaria
          </button>

          <button
            className={`nav-item ${activeSection === "shipments" ? "active" : ""}`}
            onClick={() => setActiveSection("shipments")}
          >
            Envios
          </button>

          <button
            className={`nav-item ${activeSection === "flights" || activeSection === "flight-detail" ? "active" : ""}`}
            onClick={() => setActiveSection("flights")}
          >
            Vuelos
          </button>

          <button
            className={`nav-item ${activeSection === "airports" || activeSection === "airport-detail" ? "active" : ""}`}
            onClick={() => setActiveSection("airports")}
          >
            Aeropuertos
          </button>

          <button
            className={`nav-item ${activeSection === "sim" ? "active" : ""}`}
            onClick={() => setActiveSection("sim")}
          >
            Simulación
          </button>

          <button className="nav-item">Reportes</button>
          <button className="nav-item">Configuración</button>
        </nav>
      </header>

      <main className="main">
        {activeSection === "daily" ? <DailyOperationPage /> : null}
        {activeSection === "sim" ? <SimulationPage /> : null}
        
        {activeSection === "flights" ? (
          <FlightsCrud 
            onViewDetail={(id) => {
              setSelectedId(id);
              setActiveSection('flight-detail');
            }} 
          />
        ) : null}
        
        {activeSection === "flight-detail" ? (
          <FlightDetailPage 
            flightId={selectedId as number} 
            onVolver={() => setActiveSection('flights')} 
          />
        ) : null}

        {activeSection === "airports" ? (
          <AirportsCrud 
            onViewDetail={(codigoOaci) => {
              setSelectedId(codigoOaci);
              setActiveSection('airport-detail');
            }}
          />
        ) : null}

        {activeSection === "airport-detail" ? (
          <WarehouseDetailPage 
            airportCode={selectedId as string} 
            onVolver={() => setActiveSection('airports')} 
          />
        ) : null}

        {activeSection === "shipments" ? <ShipmentsCrud /> : null}
      </main>
    </div>
  );
}