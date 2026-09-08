/*
Wraps a set of routes so they only render once we know someone is logged
in. While the initial GET /api/auth/me is still in flight we show
LoadingState instead of flashing the page and then redirecting; that
flash is what a guard is meant to prevent.
*/

import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'
import LoadingState from './states/LoadingState'

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
