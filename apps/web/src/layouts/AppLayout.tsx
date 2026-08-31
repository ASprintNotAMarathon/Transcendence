import { NavLink, Outlet } from 'react-router'

/**
 * Layout for authenticated screens. The header (nav, profile, logout) sits
 * above <Outlet /> so it never unmounts while the user navigates between
 * pages, per issue #18.
 */
function AppLayout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm transition-colors ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`

  function handleLogout() {
    // Wiring to the API happens once auth exists. For now this is a no-op
    // placeholder so the header shape is agreed on.
    console.log('logout clicked')
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <nav className="flex items-center gap-6">
			<NavLink to="/home" className={linkClass}>
			Home
			</NavLink>
        </nav>

        <div className="flex items-center gap-4">
          <NavLink to="/profile" className={linkClass}>
            Profile
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
