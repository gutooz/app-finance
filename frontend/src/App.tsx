import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import { getMe } from './api/client'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import CoupleSetup from './pages/CoupleSetup'
import Dashboard from './pages/Dashboard'
import AddExpense from './pages/AddExpense'
import Bills from './pages/Bills'
import Goals from './pages/Goals'
import Summary from './pages/Summary'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'
import CompleteProfile from './pages/CompleteProfile'
import Admin from './pages/Admin'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useStore()
  if (!session) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function RequireCouple({ children }: { children: React.ReactNode }) {
  const { session, couple } = useStore()
  if (!session) return <Navigate to="/auth" replace />
  if (!couple) return <Navigate to="/setup" replace />
  return <>{children}</>
}

function App() {
  const { profile, session, setProfile, setCouple, clear } = useStore()
  const themeClass = profile?.gender === 'male' ? 'theme-male' : 'theme-female'

  useEffect(() => {
    if (!session?.access_token) return
    // Validate token and refresh profile/couple on page load
    getMe()
      .then(me => {
        setProfile(me.profile || null)
        setCouple(me.couple || null)
      })
      .catch(() => clear())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={themeClass}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth key="auth-login" />} />
          <Route path="/login" element={<Auth key="login" />} />
          <Route path="/cadastro" element={<Auth key="register" initialMode="register" />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/setup" element={<RequireAuth><CoupleSetup /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireCouple><Dashboard /></RequireCouple>} />
          <Route path="/expenses/new" element={<RequireCouple><AddExpense /></RequireCouple>} />
          <Route path="/bills" element={<RequireCouple><Bills /></RequireCouple>} />
          <Route path="/goals" element={<RequireCouple><Goals /></RequireCouple>} />
          <Route path="/summary" element={<RequireCouple><Summary /></RequireCouple>} />
          <Route path="/calendar" element={<RequireCouple><Calendar /></RequireCouple>} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
