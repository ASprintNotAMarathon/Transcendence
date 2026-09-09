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
import NotFoundPage from './pages/NotFoundPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
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
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
