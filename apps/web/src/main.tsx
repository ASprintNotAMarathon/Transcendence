import { StrictMode, type ReactNode , useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import './index.css'
import { AuthProvider, useAuth } from './auth/AuthContext.tsx'
import { setCurrentUserId } from './chat/chat.ts'
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
import FriendsPage from './pages/FriendsPage.tsx'
import MatchPage from './pages/MatchPage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'
import PrivacyPage from './pages/PrivacyPage.tsx'
import TermsPage from './pages/TermsPage.tsx'
import { SocketProvider } from './socket/SocketProvider.tsx'


function AppSocketProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()
  // Keep chatClient informed about which "user" is logged in.
  // This allows it to recognise messages when they arrive from the server.
  // When the user logs out, reset the ID to an empty string.
  useEffect(() => {
    setCurrentUserId(user?.id ?? '')
  }, [user])
  return (
    <SocketProvider enabled={status === 'authenticated'}>
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
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route element={<GuestOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/home" element={<HomePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profile/:id" element={<ProfilePage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/friends" element={<FriendsPage />} />
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

//main.tsx starts the react app by reactDOM.createRoot and rendering the app into the root div in index.html. 
//React uses react-router to handle routing between pages
//React renders pages based on the route. The routes are defined in the Routes component of React Router. 
//The routes are nested inside the PublicLayout and AppLayout components.
