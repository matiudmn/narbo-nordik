import { lazy, Suspense } from 'react';
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
import ResetPassword from './pages/ResetPassword';
import { PageSkeleton } from './components/Skeleton';

const AthleteDetail = lazy(() => import('./pages/athlete/AthleteDetail'));
const ClubProfile = lazy(() => import('./pages/ClubProfile'));
const Dashboard = lazy(() => import('./pages/coach/Dashboard'));
const SessionEditor = lazy(() => import('./pages/coach/SessionEditor'));
const Settings = lazy(() => import('./pages/coach/Settings'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Palmares = lazy(() => import('./pages/Palmares'));
const VmaHistory = lazy(() => import('./pages/VmaHistory'));
const TrainingHistory = lazy(() => import('./pages/TrainingHistory'));
const Help = lazy(() => import('./pages/Help'));
const Suivi = lazy(() => import('./pages/athlete/Suivi'));

function AppRoutes() {
  const { user } = useAuth();

  // Reset password must be accessible without full auth (recovery token only)
  if (window.location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  if (!user) {
    return <Login />;
  }

  const isCoach = user.role === 'coach';

  return (
    <Suspense fallback={<div className="pt-14 pb-20 px-4 max-w-5xl mx-auto"><PageSkeleton /></div>}>
      <Routes>
        <Route element={<Layout />}>
          {/* Shared routes */}
          <Route path="/" element={<Home />} />
          <Route path="/session/:id" element={<SessionDetail />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/directory/:id" element={<AthleteDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/club" element={<ClubProfile />} />
          <Route path="/palmares" element={<Palmares />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/vma-history" element={<VmaHistory />} />
          <Route path="/training-history" element={<TrainingHistory />} />
          <Route path="/aide" element={<Help />} />
          <Route path="/suivi" element={<Suivi />} />

          {/* Coach routes */}
          <Route path="/coach" element={isCoach ? <Dashboard /> : <Navigate to="/" />} />
          <Route path="/coach/sessions" element={isCoach ? <SessionEditor /> : <Navigate to="/" />} />
          <Route path="/coach/settings" element={isCoach ? <Settings /> : <Navigate to="/" />} />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </Suspense>
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
