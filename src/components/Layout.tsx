import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import { motion, AnimatePresence, DUR, EASE } from '../lib/motion';

export default function Layout() {
  const { isImpersonating } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <div className="lg:ml-60">
        <Header />
        <main className={`${isImpersonating ? 'pt-[5.5rem]' : 'pt-14'} lg:pt-4 ${isImpersonating ? 'lg:pt-12' : ''} pb-20 lg:pb-8 px-4 lg:px-8 max-w-6xl mx-auto safe-bottom`}>
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
  );
}
