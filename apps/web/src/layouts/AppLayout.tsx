import { NavLink, Outlet } from 'react-router'

function AppLayout() {
  const navButtonClass = 'btn btn-sm tracking-wide border-2 btn-outline-accent'
  function handleLogout() {
    console.log('logout clicked')
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <NavLink to="/home" className="font-barrio text-4xl text-(--color-primary-content)">
          <span className="glow-pulse text-(--color-primary)">GO</span>MOKU FRIENDS
        </NavLink>

        <div className="flex items-center gap-3">
          <NavLink to="/profile" className={navButtonClass}>
            Profile
          </NavLink>
          <button type="button" onClick={handleLogout} className={navButtonClass}>
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