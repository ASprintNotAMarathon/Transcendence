
/**
 * Layout for unauthenticated screens (login, register).
 * No header/nav, just a centered content area.
 */
import { Outlet } from 'react-router'

function PublicLayout() {
  return (
    <div className="min-h-screen bg-slate-900">
      <Outlet />
    </div>
  )
}

export default PublicLayout
