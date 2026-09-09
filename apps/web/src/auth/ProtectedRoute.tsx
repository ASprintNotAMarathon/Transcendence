/*
  ProtectedRoute. Used in main.tsx around /home and /profile.
  
  A user's status here is always one of three:
  - Opened the app or refreshed: sees LoadingState 
  - Logged in: sees the page they asked for
  - Not logged in (typed the URL directly, or session gone): sent straight
    to /login 
 
    status === 'loading'        -> render LoadingState
    status === 'authenticated'  -> render Outlet, the actual page
    status === 'anonymous'      -> navigate to /login
*/

import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthContext'
import LoadingState from '../components/states/LoadingState'

function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <LoadingState message="Checking your session…" />
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export default ProtectedRoute
