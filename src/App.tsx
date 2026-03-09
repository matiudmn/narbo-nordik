import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import Layout from './components/Layout';
import InstallPrompt from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import ConsentBanner from './components/ConsentBanner';
import { NotificationProvider } from './contexts/NotificationContext';
import { InAppNotificationProvider } from './contexts/InAppNotificationContext';
import Login from './pages/Login';
import Home from './pages/Home';
import SessionDetail from './pages/athlete/SessionDetail';
import Directory from './pages/athlete/Directory';
import Profile from './pages/athlete/Profile';
import ClubProfile from './pages/ClubProfile';
import Dashboard from './pages/coach/Dashboard';
import SessionEditor from './pages/coach/SessionEditor';
import Settings from './pages/coach/Settings';
import Notifications from './pages/Notifications';
import Palmares from './pages/Palmares';
import VmaHistory from './pages/VmaHistory';

function AppRoutes() {
  const { user } = useAuth();

  if (!user) {
    return <Login />;
  }

  const isCoach = user.role === 'coach';

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Shared routes */}
        <Route path="/" element={<Home />} />
        <Route path="/session/:id" element={<SessionDetail />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/club" element={<ClubProfile />} />
        <Route path="/palmares" element={<Palmares />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/vma-history" element={<VmaHistory />} />

        {/* Coach routes */}
        <Route path="/coach" element={isCoach ? <Dashboard /> : <Navigate to="/" />} />
        <Route path="/coach/sessions" element={isCoach ? <SessionEditor /> : <Navigate to="/" />} />
        <Route path="/coach/settings" element={isCoach ? <Settings /> : <Navigate to="/" />} />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <InAppNotificationProvider>
            <NotificationProvider>
              <OfflineIndicator />
              <AppRoutes />
              <InstallPrompt />
              <ConsentBanner />
            </NotificationProvider>
          </InAppNotificationProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
