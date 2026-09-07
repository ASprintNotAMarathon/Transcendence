import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'

function AppLayout() {
  const navButtonClass = 'btn btn-sm tracking-wide border-2 btn-outline-accent'
  const { logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    // logout() only clears the session cookie and our own context for now.
    // Once #24 lands there is a socket to close here too, see 1.2's "Done
    // when": "Logout clears the context, closes the socket, returns to
    // the public layout."
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <header className="relative z-10 flex items-center justify-between bg-(--color-base-200)/50 px-6 py-5 backdrop-blur-md">
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
