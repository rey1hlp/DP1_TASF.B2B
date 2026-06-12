import type { ComponentType } from 'react'
import { NavLink } from 'react-router'

type SidebarNavItemProps = {
  to: string
  label: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
  end?: boolean
}

export default function SidebarNavItem({
  to,
  label,
  icon: Icon,
  end = false,
}: SidebarNavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    >
      <Icon size={18} strokeWidth={2} />
      <span className="nav-label">{label}</span>
    </NavLink>
  )
}