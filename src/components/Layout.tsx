import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import OfflineIndicator from './OfflineIndicator';
import { GlobalSearchProvider } from '../contexts/GlobalSearchContext';
import { motion, AnimatePresence, DUR, EASE } from '../lib/motion';

export default function Layout() {
  const { isImpersonating } = useAuth();
  const location = useLocation();

  return (
    <GlobalSearchProvider>
      <div className="min-h-screen bg-surface">
        <Sidebar />
        <OfflineIndicator />
        <div className="lg:ml-60">
          <Header />
          {/* Compense la hauteur réelle des barres fixes : header/bandeau + safe-area
              en haut, bottom nav + safe-area en bas (PWA iOS, viewport-fit=cover). */}
          <main className={`${isImpersonating ? 'pt-[calc(5.5rem+env(safe-area-inset-top))]' : 'pt-[calc(3.5rem+env(safe-area-inset-top))]'} lg:pt-4 ${isImpersonating ? 'lg:pt-12' : ''} pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8 px-4 lg:px-8 max-w-6xl mx-auto`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: DUR.fast, ease: EASE.out }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <BottomNav />
      </div>
    </GlobalSearchProvider>
  );
}
