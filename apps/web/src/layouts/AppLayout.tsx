import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { nextDemoPlayer } from '../lib/devFixtures'

function AppLayout() {
  const navButtonClass = 'btn btn-sm tracking-wide border-2 btn-outline-accent'
  const { logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
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
        {/* TEMP: until matchmaking exists this opens the seeded demo match, as ada and linus in turn. */}
        <button
          type="button"
          onClick={() => window.location.assign(`/match/demo?as=${nextDemoPlayer()}`)}
          className={navButtonClass}
        >
            Match
          </button>
        <NavLink to="/chat" className={navButtonClass}>
            Chat
          </NavLink>
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
