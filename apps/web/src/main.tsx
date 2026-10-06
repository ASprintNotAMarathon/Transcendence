import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import './index.css'
import { AuthProvider, useAuth } from './auth/AuthContext.tsx'
import GuestOnlyRoute from './auth/GuestOnlyRoute.tsx'
import ProtectedRoute from './auth/ProtectedRoute.tsx'
import PublicLayout from './layouts/PublicLayout.tsx'
import AppLayout from './layouts/AppLayout.tsx'
import LandingPage from './pages/LandingPage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import RegisterPage from './pages/RegisterPage.tsx'
import HomePage from './pages/HomePage.tsx'
import ProfilePage from './pages/ProfilePage.tsx'
import ChatPage from './pages/ChatPage.tsx'
import MatchPage from './pages/MatchPage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'
import { SocketProvider } from './socket/SocketProvider.tsx'
import { devUserId } from './lib/devFixtures.ts'

function AppSocketProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  return (
    <SocketProvider enabled={status === 'authenticated'} devUserId={devUserId}>
      {children}
    </SocketProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppSocketProvider>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route element={<GuestOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/home" element={<HomePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/match/:matchId" element={<MatchPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
