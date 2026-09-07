/*
Mirror image of ProtectedRoute. Someone who is already logged in and
opens /login or /register shouldn't see the form, they should just land
in the app. Same loading rule applies: don't decide anything until the
initial GET /api/auth/me has resolved.
*/

import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../context/AuthContext'
import LoadingState from './LoadingState'

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
