import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import './index.css'
import { AuthProvider } from './auth/AuthContext.tsx'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {/*
          TEMP: every visitor connects as u1 the moment the page loads.
          TODO: AuthProvider is on main now, so this can become
            enabled={status === 'authenticated'} devUserId={user?.id}
          read from useAuth() through a small component inside this provider.
          devUserId goes entirely when #21 ships.
        */}
        <SocketProvider enabled devUserId="u1">
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
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
