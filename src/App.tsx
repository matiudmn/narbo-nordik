import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import InstallPrompt from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import ConsentBanner from './components/ConsentBanner';
import { NotificationProvider } from './contexts/NotificationContext';
import { InAppNotificationProvider } from './contexts/InAppNotificationContext';
import { ToastProvider } from './components/ui';
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
const Import = lazy(() => import('./pages/coach/Import'));
const QuickAddSession = lazy(() => import('./pages/coach/QuickAddSession'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Palmares = lazy(() => import('./pages/Palmares'));
const VmaHistory = lazy(() => import('./pages/VmaHistory'));
const TrainingHistory = lazy(() => import('./pages/TrainingHistory'));
const Help = lazy(() => import('./pages/Help'));
const Suivi = lazy(() => import('./pages/athlete/Suivi'));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));

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
          <Route path="/coach/import" element={isCoach ? <Import /> : <Navigate to="/" />} />
          <Route path="/coach/nouvelle-seance" element={isCoach ? <QuickAddSession /> : <Navigate to="/" />} />
          <Route path="/coach/settings" element={isCoach ? <Settings /> : <Navigate to="/" />} />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function AuthenticatedApp() {
  return (
    <ToastProvider>
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
    </ToastProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/*
            Routes publiques : montées hors des providers, donc rendues sans
            session Supabase ni garde d'authentification.
          */}
          <Route
            path="/legal/privacy"
            element={
              <Suspense fallback={<div className="min-h-screen bg-bg-base" />}>
                <PrivacyPolicy />
              </Suspense>
            }
          />
          <Route path="*" element={<AuthenticatedApp />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
