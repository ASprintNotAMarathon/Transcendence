import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { ConnectionStatus } from '../socket/ConnectionStatus'
import UserMenu from '../components/UserMenu'
import ChatPopup from '../chat/ChatPopup'
import Footer from '../components/Footer'

function AppLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    // No socket cleanup here! Discussed with Renata:
    // socket will live in a SocketProvider above the routes, and
    // close itself automatically when auth status becomes anonymous
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative z-10 flex items-center justify-between bg-(--color-base-200)/50 px-6 py-5 backdrop-blur-md">
        <NavLink to="/home" className="font-barrio text-4xl text-(--color-primary-content)">
          <span className="glow-pulse text-(--color-primary)">GO</span>MOKU FRIENDS
        </NavLink>

        <div className="flex items-center gap-3">
          <ConnectionStatus />
          <UserMenu onLogout={handleLogout} />
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <Outlet />
      </main>
      <Footer />
      <ChatPopup />
    </div>
  )
}

export default AppLayout
