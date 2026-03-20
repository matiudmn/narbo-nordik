import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';

export default function Layout() {
  const { isImpersonating } = useAuth();

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <div className="lg:ml-60">
        <Header />
        <main className={`${isImpersonating ? 'pt-[5.5rem]' : 'pt-14'} lg:pt-4 ${isImpersonating ? 'lg:pt-12' : ''} pb-20 lg:pb-8 px-4 lg:px-8 max-w-6xl mx-auto`}>
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
