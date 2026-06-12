import { useState } from 'react'
import { Outlet } from 'react-router'
import AppTopbar from '../components/layout/AppTopbar'
import AppSidebar from '../components/layout/AppSidebar'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <AppTopbar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((current) => !current)}
      />

      <div className="app-body">
        {sidebarOpen && <AppSidebar />}

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}