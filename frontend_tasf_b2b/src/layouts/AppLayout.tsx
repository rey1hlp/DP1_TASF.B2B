import { useState, type ReactNode } from 'react'
import { Outlet } from 'react-router'
import AppTopbar from '../components/layout/AppTopbar'
import AppSidebar from '../components/layout/AppSidebar'

export type AppLayoutContext = {
  setTopbarMain: (content: ReactNode) => void
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [topbarMain, setTopbarMain] = useState<ReactNode>(null)

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <AppTopbar
        topbarMain={topbarMain}
        onToggleSidebar={() => setSidebarOpen((current) => !current)}
      />

      <div className="app-body">
        {sidebarOpen && <AppSidebar />}

        <main className="app-main">
          <Outlet context={{ setTopbarMain } satisfies AppLayoutContext} />
        </main>
      </div>
    </div>
  )
}