import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import RequireAuth from './components/ui/RequireAuth'
import LoginPage from './pages/login/LoginPage'
import HubPage from './pages/hub/HubPage'
import DailyArchivesPage from './pages/archives/DailyArchivesPage'
import CreatePage from './pages/create/CreatePage'
import PlayPage from './pages/play/PlayPage'
import ResultPage from './pages/result/ResultPage'
import ProfilePage from './pages/profile/ProfilePage'
import DashboardPage from './pages/dashboard/DashboardPage'
import DailyAdminPage from './pages/admin/DailyAdminPage'
import ClassementPage from './pages/classement/ClassementPage'
import TutorielPage from './pages/tutoriel/TutorielPage'
import RaidArenaPage from './pages/raid/RaidArenaPage'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/hub" replace />} />
        <Route path="/hub"               element={<RequireAuth><HubPage /></RequireAuth>} />
        <Route path="/daily-archives"    element={<RequireAuth><DailyArchivesPage /></RequireAuth>} />
        <Route path="/create"            element={<RequireAuth><CreatePage /></RequireAuth>} />
        <Route path="/play/:gridId"      element={<RequireAuth><PlayPage /></RequireAuth>} />
        <Route path="/result/:gridId"    element={<RequireAuth><ResultPage /></RequireAuth>} />
        <Route path="/profile"           element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/dashboard/:gridId" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/admin/daily"       element={<RequireAuth><DailyAdminPage /></RequireAuth>} />
        <Route path="/classement"        element={<RequireAuth><ClassementPage /></RequireAuth>} />
        <Route path="/tutoriel"          element={<RequireAuth><TutorielPage /></RequireAuth>} />
        {/* Mode RAID — route ouverte (RequireAuth) pour permettre le test multi-session ;
            le lien n'est visible que pour l'admin (Header) tant que la feature est en test. */}
        <Route path="/raid"              element={<RequireAuth><RaidArenaPage /></RequireAuth>} />
        <Route path="*"                  element={<Navigate to="/hub" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
