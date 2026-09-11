/*
    GuestOnlyRoute. Used in main.tsx around /login and /register
    
    A user's status here is always one of three:
    - Opened the app or refreshed: sees LoadingState
    - Not logged in: sees the login or register form
    - Already logged in but opens /login anyway: sent straight to /home,
      never sees the login form again
    
        status === 'loading'        -> render LoadingState
        status === 'authenticated'  -> navigate to /home
        status === 'anonymous'      -> render Outlet, the actual form
*/
import { Navigate, Outlet } from 'react-router'
import { useAuth } from './AuthContext'
import LoadingState from '../components/states/LoadingState'

function GuestOnlyRoute() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <LoadingState message="Checking your session…" />
  }

  if (status === 'authenticated') {
    return <Navigate to="/home" replace />
  }

  return <Outlet />
}

export default GuestOnlyRoute
