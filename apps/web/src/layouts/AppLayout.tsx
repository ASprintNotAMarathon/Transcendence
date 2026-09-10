import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import PrimaryLink from '../components/PrimaryLink'
import PrimaryButton from '../components/PrimaryButton'

function AppLayout() {
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
          <PrimaryLink to="/profile" size="small">Profile</PrimaryLink>
          <PrimaryButton type="button" onClick={handleLogout} size="small">Log out</PrimaryButton>
        </div>
      </header>
      
      <main className="px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
