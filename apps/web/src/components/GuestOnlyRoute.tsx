/*
  GuestOnlyRoute. Used in main.tsx around /login and /register. 
  Mirror image of ProtectedRoute.
 
    status === 'loading'        -> show LoadingState
    status === 'authenticated'  -> redirect to /home
    status === 'anonymous'      -> render the route (the actual form)

*/
import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../context/AuthContext'
import LoadingState from './states/LoadingState'

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
