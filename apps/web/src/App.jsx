import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './layouts/AppLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import Feed from './pages/Feed'
import Upload from './pages/Upload'
import Friends from './pages/Friends'
import FriendRequests from './pages/FriendRequests'
import Notifications from './pages/Notifications'
import Gallery from './pages/Gallery'
import Streaks from './pages/Streaks'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Gold from './pages/Gold'
import GoldCustomize from './pages/GoldCustomize'
import AdminDebug from './pages/AdminDebug'
import ConnectLocket from './pages/ConnectLocket'
import VerifyEmail from './pages/VerifyEmail'
import Chat from './pages/Chat'

function PublicOnly({ children }) {
  const { user, booting } = useApp()
  if (booting) return null
  if (user) return <Navigate to="/app/feed" replace />
  return children
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="upload" replace />} />
            <Route path="feed" element={<Feed />} />
            <Route path="upload" element={<Upload />} />
            <Route path="camera" element={<Navigate to="/app/upload" replace />} />
            <Route path="friends" element={<Friends />} />
            <Route path="friends/requests" element={<FriendRequests />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="streaks" element={<Streaks />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="gold" element={<Gold />} />
            <Route path="gold/customize" element={<GoldCustomize />} />
            <Route path="connect-locket" element={<ConnectLocket />} />
            <Route path="official-sync" element={<ConnectLocket />} />
            <Route path="chat" element={<Chat />} />
            <Route path="messages" element={<Chat />} />
            <Route path="admin" element={<AdminDebug />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
